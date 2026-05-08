import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';
import helmet from 'helmet';
import axios from 'axios';
import { DataTypes } from 'sequelize';

import { createConnection } from '../../shared/config/db.js';
import { authenticate, requireAffiliate } from '../../middleware/auth.js';
import { getRedisClient, KEYS } from '../../shared/config/redis.js';

const app = express();
const PORT = process.env.SERVER3_PORT || 3003;

const sequelize = createConnection({
  name: process.env.DB_PAY_NAME,
  user: process.env.DB_PAY_USER,
  pass: process.env.DB_PAY_PASS,
  host: process.env.DB_PAY_HOST,
  port: process.env.DB_PAY_PORT,
}, 'Payment Service');

// ===================== MODELS =====================
const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  registrationId: { type: DataTypes.UUID, allowNull: false, field: 'registration_id' },
  affiliateId: { type: DataTypes.UUID, allowNull: false, field: 'affiliate_id' },
  paidUserId: { type: DataTypes.UUID, allowNull: false, field: 'paid_user_id' },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  commission: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  paystackRef: { type: DataTypes.STRING, unique: true, field: 'paystack_ref' },
  paystackStatus: { 
    type: DataTypes.ENUM('pending', 'success', 'failed'), 
    defaultValue: 'pending', 
    field: 'paystack_status' 
  },
  commissionCredited: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'commission_credited' },
}, { 
  tableName: 'transactions', 
  underscored: true,
  timestamps: true 
});

// ===================== MIDDLEWARE =====================
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(helmet());
// this is done to check if the server is running via terminal
app.get("/", (req, res) => {
  res.json({
    service: "Payment Service",
    status: "running",
    port: 3003
  });
});
// Raw body for webhook (MUST be before express.json())
app.post('/api/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

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
app.use(express.json());

// ===================== PAYMENT LOGIC =====================
async function processSuccessfulPayment(reference, metadata, amount) {
  try {
    const txn = await Transaction.findOne({ where: { paystackRef: reference } });
    if (!txn || txn.commissionCredited) return;

    const commission = parseFloat((amount * 0.05).toFixed(2)); // 5% commission

    const redis = await getRedisClient();
    await Promise.all([
      redis.incrbyfloat(KEYS.affiliateBalance(metadata.affiliateId), commission),
      redis.zincrby(KEYS.leaderboard(), commission, metadata.affiliateId)
    ]);

    await txn.update({
      commissionCredited: true,
      paystackStatus: 'success',
      commission
    });

    // Notify Registration Service
    const lbPort = process.env.LOAD_BALANCER_PORT || 3000;
    await axios.patch(`http://localhost:${lbPort}/api/registrations/${metadata.registrationId}/mark-paid`, {
      paystackRef: reference
    });

    console.log(`✅ Commission credited: ₦${commission} to ${metadata.affiliateId}`);
  } catch (err) {
    console.error('[PAY] Payment Processing Failed:', err.message);
  }
}

// ===================== ROUTES =====================
app.post('/api/payments/initialize', authenticate, requireAffiliate, async (req, res) => {
  try {
    const { registrationId, paidUserEmail, amount, paidUserId } = req.body;

    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: paidUserEmail,
        amount: Math.round(amount * 100),
        metadata: { registrationId, affiliateId: req.user.id, paidUserId }
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const { authorization_url, reference } = paystackRes.data.data;

    await Transaction.create({
      registrationId,
      affiliateId: req.user.id,
      paidUserId,
      amount,
      commission: amount * 0.05,
      paystackRef: reference,
    });

    res.json({ authorization_url, reference });
  } catch (err) {
    console.error("[PAY] Initialize Error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

app.get('/api/commissions/balance', authenticate, requireAffiliate, async (req, res) => {
  try {
    const redis = await getRedisClient();
    const balance = await redis.get(KEYS.affiliateBalance(req.user.id)) || '0';
    res.json({ balance: parseFloat(balance).toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

app.get('/health', (_, res) => {
  res.json({ service: 'payment-service', status: 'OK', port: PORT });
});

// ===================== START SERVER =====================
const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });   // Be careful in production
    app.listen(PORT, () => {
      console.log(`💰 Payment Service running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Payment Service failed to start:', err);
    process.exit(1);
  }
};

start();