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
import { DataTypes } from 'sequelize';

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

    // FIX: 10% commission of the payment amount
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

    // FIX: include x-service-secret header when calling registration service
    const lbPort = process.env.LOAD_BALANCER_PORT || 3000;
    await axios.patch(
      `http://localhost:${lbPort}/api/registrations/${metadata.registrationId}/mark-paid`,
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
// Affiliate initiates payment for an approved registration
app.post('/api/payments/initialize', authenticate, requireAffiliate, async (req, res) => {
  try {
    const { registrationId, paidUserEmail, amount } = req.body;

    if (!registrationId || !paidUserEmail || !amount)
      return res.status(400).json({ error: 'registrationId, paidUserEmail and amount are required' });

    // Check for duplicate — don't create two transactions for the same registration
    const existing = await Transaction.findOne({
      where: { registrationId, paystackStatus: ['pending', 'success'] }
    });
    if (existing)
      return res.status(409).json({ error: 'Payment already initialized for this registration' });

    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: paidUserEmail,
        amount: Math.round(amount * 100), // Paystack expects kobo
        metadata: {
          registrationId,
          affiliateId: req.user.id,
        },
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const { authorization_url, reference } = paystackRes.data.data;

    await Transaction.create({
      registrationId,
      affiliateId: req.user.id,
      paidUserEmail,
      amount,
      commission: parseFloat((amount * 0.10).toFixed(2)), // 10%
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
// Verify payment after Paystack redirect (before webhook fires)
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
    // Get top 10 affiliates by commission earned (highest first)
    const results = await redis.zrevrange(KEYS.leaderboard(), 0, 9, 'WITHSCORES');

    // Results come back as [id, score, id, score, ...]
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