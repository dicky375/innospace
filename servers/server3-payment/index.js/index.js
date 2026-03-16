require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const { createConnection } = require('../../shared/config/db');
const { authenticate, requireIntern } = require('../../shared/middleware/auth');
const { getRedisClient, KEYS } = require('../../shared/config/redis');

const app = express();
const PORT = process.env.SERVER3_PORT || 3003;
const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.05');
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

app.use('/api/webhook/paystack', express.raw({ type: 'application/json' }));
app.use(cors()); app.use(express.json()); app.use(morgan('dev'));

const db = createConnection(process.env.MONGO_URI_PAYMENT, 'Server3 (payment)');

const transactionSchema = new mongoose.Schema({
  registrationId:     { type: mongoose.Schema.Types.ObjectId, required: true },
  internId:           { type: mongoose.Schema.Types.ObjectId, required: true },
  paidUserId:         { type: mongoose.Schema.Types.ObjectId, required: true },
  amount:             { type: Number, required: true },
  commission:         { type: Number, required: true },
  paystackRef:        { type: String, unique: true },
  paystackStatus:     { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  commissionCredited: { type: Boolean, default: false },
}, { timestamps: true });

const Transaction = db.model('Transaction', transactionSchema);

async function initializePayment({ email, amount, metadata }) {
  const res = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    { email, amount: amount * 100, metadata },
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  );
  return res.data.data;
}

async function verifyPayment(reference) {
  const res = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  );
  return res.data.data;
}

async function creditCommission({ internId, amount, transactionId }) {
  const commission = parseFloat((amount * COMMISSION_RATE).toFixed(2));
  const redis = await getRedisClient();
  await redis.incrbyfloat(KEYS.internBalance(internId), commission);
  await redis.zIncrBy(KEYS.leaderboard(), commission, internId.toString());
  await Transaction.findByIdAndUpdate(transactionId, { commissionCredited: true, commission, paystackStatus: 'success' });
  return commission;
}

// POST /api/payments/initialize
app.post('/api/payments/initialize', authenticate, requireIntern, async (req, res) => {
  try {
    const { registrationId, paidUserEmail, amount, paidUserId } = req.body;
    if (!registrationId || !paidUserEmail || !amount)
      return res.status(400).json({ error: 'registrationId, paidUserEmail and amount required' });

    const paystack = await initializePayment({
      email: paidUserEmail, amount,
      metadata: { registrationId, internId: req.user.id, paidUserId },
    });

    await Transaction.create({
      registrationId, internId: req.user.id, paidUserId,
      amount, commission: amount * COMMISSION_RATE,
      paystackRef: paystack.reference,
    });

    res.json({ authorization_url: paystack.authorization_url, reference: paystack.reference });
  } catch (err) {
    res.status(500).json({ error: 'Could not initialize payment' });
  }
});

// GET /api/payments/verify/:reference
app.get('/api/payments/verify/:reference', authenticate, async (req, res) => {
  try {
    const data = await verifyPayment(req.params.reference);
    if (data.status !== 'success')
      return res.status(402).json({ error: 'Payment not successful', status: data.status });

    const txn = await Transaction.findOne({ paystackRef: req.params.reference });
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    if (!txn.commissionCredited) {
      const commission = await creditCommission({ internId: txn.internId, amount: txn.amount, transactionId: txn._id });
      await axios.patch(
        `http://localhost:${process.env.SERVER2_PORT || 3002}/api/registrations/${txn.registrationId}/mark-paid`,
        { paystackRef: req.params.reference }
      );
      const redis = await getRedisClient();
      return res.json({
        message: 'Payment verified — commission credited',
        amount: txn.amount, commission,
        internBalance: await redis.get(KEYS.internBalance(txn.internId)),
      });
    }

    res.json({ message: 'Already processed', transaction: txn });
  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/webhook/paystack
app.post('/api/webhook/paystack', async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET)
    .update(req.body)
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature'])
    return res.status(401).json({ error: 'Invalid signature' });

  const event = JSON.parse(req.body);
  if (event.event === 'charge.success') {
    const { reference, metadata, amount } = event.data;
    const txn = await Transaction.findOne({ paystackRef: reference });
    if (txn && !txn.commissionCredited) {
      await creditCommission({ internId: metadata.internId, amount: amount / 100, transactionId: txn._id });
      await axios.patch(
        `http://localhost:${process.env.SERVER2_PORT || 3002}/api/registrations/${metadata.registrationId}/mark-paid`,
        { paystackRef: reference }
      );
    }
  }
  res.sendStatus(200);
});

// GET /api/commissions/balance
app.get('/api/commissions/balance', authenticate, requireIntern, async (req, res) => {
  const redis = await getRedisClient();
  const balance = await redis.get(KEYS.internBalance(req.user.id));
  res.json({ internId: req.user.id, balance: parseFloat(balance || '0').toFixed(2) });
});

// GET /api/commissions/leaderboard
app.get('/api/commissions/leaderboard', authenticate, async (req, res) => {
  const redis = await getRedisClient();
  const top = await redis.zRangeWithScores(KEYS.leaderboard(), 0, 9, { REV: true });
  res.json({ leaderboard: top.map((e, i) => ({ rank: i + 1, internId: e.value, earned: e.score })) });
});

app.get('/health', (_, res) => res.json({ server: 'server3-payment', status: 'ok' }));
app.listen(PORT, () => console.log(`[Server 3 — Payment] running on port ${PORT}`));