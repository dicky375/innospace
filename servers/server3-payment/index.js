import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';
import helmet from 'helmet';
import axios from 'axios';
import { DataTypes, Op } from 'sequelize';

import { createConnection } from '../../shared/config/db.js';
import { authenticate, requireAffiliate, requireAdmin } from '../../middleware/auth.js';
import { getRedisClient, KEYS } from '../../shared/config/redis.js';

const app = express();
const PORT = process.env.SERVER3_PORT || 3003;

// ===================== DATABASE =====================
const sequelize = createConnection({
  name: process.env.DB_PAY_NAME,
  user: process.env.DB_PAY_USER,
  pass: process.env.DB_PAY_PASS,
  host: process.env.DB_PAY_HOST,
  port: process.env.DB_PAY_PORT,
}, 'Payment Service');

// ===================== MODELS =====================
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  registrationId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'registration_id'
  },
  affiliateId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'affiliate_id'
  },
  paidUserEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'paid_user_email'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  commission: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  paystackRef: {
    type: DataTypes.STRING,
    unique: true,
    field: 'paystack_ref'
  },
  paystackStatus: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    defaultValue: 'pending',
    field: 'paystack_status'
  },
  commissionCredited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'commission_credited'
  },
}, {
  tableName: 'transactions',
  underscored: true,
  timestamps: true
});

const Payout = sequelize.define('Payout', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  affiliateId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'affiliate_id'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Amount requested by affiliate'
  },
  bankName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'bank_name'
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'account_number'
  },
  accountName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'account_name'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  processedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'processed_by',
    comment: 'Admin who approved or rejected'
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'processed_at'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Optional note from affiliate'
  },
}, {
  tableName: 'payouts',
  underscored: true,
  timestamps: true
});

// ===================== MIDDLEWARE =====================
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());

// ── Webhook MUST be registered before express.json() ──────────
app.post('/api/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature'])
      return res.status(401).json({ error: 'Invalid signature' });

    const event = JSON.parse(req.body.toString());

    if (event.event === 'charge.success') {
      const { reference, metadata, amount } = event.data;
      await processSuccessfulPayment(reference, metadata, amount / 100);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[PAY] Webhook Error:', err.message);
    res.sendStatus(500);
  }
});

// ── JSON body parser for all other routes ─────────────────────
app.use(express.json());

// ===================== HELPERS =====================
async function processSuccessfulPayment(reference, metadata, amount) {
  try {
    const txn = await Transaction.findOne({ where: { paystackRef: reference } });

    // Prevent duplicate webhook processing
    if (!txn || txn.commissionCredited) return;

    const commission = parseFloat((amount * 0.10).toFixed(2));

    // Credit commission in Redis
    const redis = await getRedisClient();
    await Promise.all([
      redis.incrbyfloat(KEYS.affiliateBalance(metadata.affiliateId), commission),
      redis.zincrby(KEYS.leaderboard(), commission, metadata.affiliateId),
    ]);

    // Update transaction record
    await txn.update({
      commissionCredited: true,
      paystackStatus: 'success',
      commission,
    });

    // Notify registration service
    const lbPort = process.env.LOAD_BALANCER_PORT || 3000;
    await axios.patch(
      `http://localhost:${lbPort}/reg/api/registrations/${metadata.registrationId}/mark-paid`,
      { paystackRef: reference, commission },
      { headers: { 'x-service-secret': process.env.INTERNAL_SERVICE_SECRET } }
    );

    console.log(`✅ Commission credited: ₦${commission} to affiliate ${metadata.affiliateId}`);
  } catch (err) {
    console.error('[PAY] Payment Processing Failed:', err.message);
  }
}

// ===================== ROUTES =====================

// Health check
app.get('/health', (_, res) => res.json({ service: 'payment-service', status: 'OK', port: PORT }));

// Root check
app.get('/', (_, res) => res.json({ service: 'Payment Service', status: 'running', port: PORT }));

// ── POST /api/payments/initialize ─────────────────────────────
app.post('/api/payments/initialize', authenticate, requireAffiliate, async (req, res) => {
  try {
    const { registrationId, paidUserEmail, amount } = req.body;

    if (!registrationId || !paidUserEmail || !amount)
      return res.status(400).json({ error: 'registrationId, paidUserEmail and amount are required' });

    const existing = await Transaction.findOne({
      where: {
        registrationId,
        paystackStatus: { [Op.in]: ['pending', 'success'] }
      }
    });
    if (existing)
      return res.status(409).json({ error: 'Payment already initialized for this registration' });

    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: paidUserEmail,
        amount: Math.round(amount * 100),
        metadata: { registrationId, affiliateId: req.user.id },
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const { authorization_url, reference } = paystackRes.data.data;

    await Transaction.create({
      registrationId,
      affiliateId: req.user.id,
      paidUserEmail,
      amount,
      commission: parseFloat((amount * 0.10).toFixed(2)),
      paystackRef: reference,
      paystackStatus: 'pending',
    });

    res.json({ authorization_url, reference });
  } catch (err) {
    console.error('[PAY] Initialize Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

// ── GET /api/payments/verify/:reference ───────────────────────
app.get('/api/payments/verify/:reference', authenticate, async (req, res) => {
  try {
    const { reference } = req.params;

    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const { status, amount, metadata } = paystackRes.data.data;

    if (status === 'success') {
      await processSuccessfulPayment(reference, metadata, amount / 100);
      return res.json({ status: 'success', message: 'Payment verified and processed' });
    }

    res.json({ status, message: 'Payment not successful' });
  } catch (err) {
    console.error('[PAY] Verify Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ── GET /api/payments/transactions — affiliate's transactions ──
app.get('/api/payments/transactions', authenticate, requireAffiliate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Transaction.findAndCountAll({
      where: { affiliateId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      transactions: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/payments/transactions/all — admin sees all ────────
app.get('/api/payments/transactions/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Transaction.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      transactions: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/commissions/balance — affiliate's Redis balance ───
app.get('/api/commissions/balance', authenticate, requireAffiliate, async (req, res) => {
  try {
    const redis = await getRedisClient();
    const balance = await redis.get(KEYS.affiliateBalance(req.user.id)) || '0';
    res.json({ balance: parseFloat(balance).toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// ── GET /api/commissions/leaderboard — top affiliates ─────────
app.get('/api/commissions/leaderboard', authenticate, async (req, res) => {
  try {
    const redis = await getRedisClient();
    const results = await redis.zrevrange(KEYS.leaderboard(), 0, 9, 'WITHSCORES');

    const leaderboard = [];
    for (let i = 0; i < results.length; i += 2) {
      leaderboard.push({
        affiliateId: results[i],
        totalCommission: parseFloat(results[i + 1]).toFixed(2),
        rank: leaderboard.length + 1,
      });
    }

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ===================== PAYOUT ROUTES =====================

// ── POST /api/payouts/request — affiliate requests payout ─────
app.post('/api/payouts/request', authenticate, requireAffiliate, async (req, res) => {
  try {
    const { amount, bankName, accountNumber, accountName, note } = req.body;

    if (!amount || !bankName || !accountNumber || !accountName)
      return res.status(400).json({ error: 'amount, bankName, accountNumber and accountName are required' });

    // Check affiliate has enough balance
    const redis = await getRedisClient();
    const balance = parseFloat(await redis.get(KEYS.affiliateBalance(req.user.id)) || '0');

    if (amount > balance)
      return res.status(400).json({
        error: `Insufficient balance. Available: ₦${balance.toFixed(2)}`
      });

    // Check no pending payout already exists
    const pendingPayout = await Payout.findOne({
      where: { affiliateId: req.user.id, status: 'pending' }
    });
    if (pendingPayout)
      return res.status(409).json({ error: 'You already have a pending payout request' });

    const payout = await Payout.create({
      affiliateId: req.user.id,
      amount,
      bankName,
      accountNumber,
      accountName,
      note: note || null,
      status: 'pending',
    });

    res.status(201).json({
      message: 'Payout request submitted — pending admin approval',
      payout,
    });
  } catch (err) {
    console.error('[PAY] Payout request error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/payouts/my — affiliate's payout history ──────────
app.get('/api/payouts/my', authenticate, requireAffiliate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Payout.findAndCountAll({
      where: { affiliateId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      payouts: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/payouts/pending — admin: all pending payouts ──────
app.get('/api/payouts/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Payout.findAndCountAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']], // oldest first for fairness
      limit,
      offset,
    });

    res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      payouts: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/payouts/all — admin: all payouts ──────────────────
app.get('/api/payouts/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const where = status ? { status } : {};

    const { count, rows } = await Payout.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      payouts: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/payouts/:id/approve — admin approves payout ─────
app.patch('/api/payouts/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const payout = await Payout.findByPk(req.params.id);
    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    if (payout.status !== 'pending')
      return res.status(400).json({ error: `Cannot approve — status is ${payout.status}` });

    // Deduct from affiliate's Redis balance
    const redis = await getRedisClient();
    const balance = parseFloat(await redis.get(KEYS.affiliateBalance(payout.affiliateId)) || '0');

    if (parseFloat(payout.amount) > balance)
      return res.status(400).json({ error: 'Affiliate balance is insufficient for this payout' });

    await redis.incrbyfloat(KEYS.affiliateBalance(payout.affiliateId), -parseFloat(payout.amount));

    await payout.update({
      status: 'approved',
      processedBy: req.user.id,
      processedAt: new Date(),
    });

    res.json({
      message: 'Payout approved and balance deducted',
      payout,
    });
  } catch (err) {
    console.error('[PAY] Payout approve error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/payouts/:id/reject — admin rejects payout ───────
app.patch('/api/payouts/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const payout = await Payout.findByPk(req.params.id);
    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    if (payout.status !== 'pending')
      return res.status(400).json({ error: `Cannot reject — status is ${payout.status}` });

    await payout.update({
      status: 'rejected',
      rejectionReason: reason || null,
      processedBy: req.user.id,
      processedAt: new Date(),
    });

    res.json({
      message: 'Payout rejected',
      payout,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ===================== START SERVER =====================
const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    app.listen(PORT, () => {
      console.log(`\n💰 Payment Service running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Payment Service failed to start:', err);
    process.exit(1);
  }
};

start();