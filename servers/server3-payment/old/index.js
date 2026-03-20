import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';
import axios from 'axios';
import { DataTypes } from 'sequelize';

// ✅ CORRECTED PATHS: Added an extra ../ to reach the root shared folder
import { createConnection } from '../../../shared/config/db.js';
import { authenticate, requireIntern } from '../../../shared/config/middleware/auth.js';
import { getRedisClient, KEYS } from '../../../shared/config/redis.js';

const app = express();
const PORT = process.env.SERVER3_PORT || 3003;
const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.05');
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// 1. DATABASE INITIALIZATION
const sequelize = createConnection({
  name: process.env.DB_PAY_NAME,
  user: process.env.DB_PAY_USER,
  pass: process.env.DB_PAY_PASS,
  host: process.env.DB_PAY_HOST,
  port: process.env.DB_PAY_PORT,
}, 'Server3 (payment)');

const Transaction = sequelize.define('Transaction', {
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  registrationId:     { type: DataTypes.UUID, allowNull: false, field: 'registration_id' },
  internId:           { type: DataTypes.UUID, allowNull: false, field: 'intern_id' },
  paidUserId:         { type: DataTypes.UUID, allowNull: false, field: 'paid_user_id' },
  amount:             { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  commission:         { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  paystackRef:        { type: DataTypes.STRING, unique: true, field: 'paystack_ref' },
  paystackStatus:     { type: DataTypes.ENUM('pending', 'success', 'failed'), defaultValue: 'pending', field: 'paystack_status' },
  commissionCredited: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'commission_credited' },
}, { tableName: 'transactions', underscored: true });

// 2. MIDDLEWARE (Crucial Order)
app.post('/api/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET)
    .update(req.body)
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ error: 'Invalid Paystack Signature' });
  }

  const event = JSON.parse(req.body);
  if (event.event === 'charge.success') {
    const { reference, metadata, amount } = event.data;
    await processSuccessfulPayment(reference, metadata.internId, amount / 100, metadata.registrationId);
  }
  res.sendStatus(200);
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// 3. INTERNAL LOGIC HELPERS
async function processSuccessfulPayment(reference, internId, amount, registrationId) {
  const txn = await Transaction.findOne({ where: { paystackRef: reference } });
  if (txn && !txn.commissionCredited) {
    const commission = parseFloat((amount * COMMISSION_RATE).toFixed(2));
    const redis = await getRedisClient();
    
    await Promise.all([
      redis.incrbyfloat(KEYS.internBalance(internId), commission),
      redis.zincrby(KEYS.leaderboard(), commission, internId.toString())
    ]);

    await txn.update({ commissionCredited: true, paystackStatus: 'success', commission });

    await axios.patch(`http://localhost:${process.env.LOAD_BALANCER_PORT || 3000}/api/registrations/${registrationId}/mark-paid`, {
      paystackRef: reference
    }).catch(err => console.error(`[PAY] Failed to notify Reg Service: ${err.message}`));
    
    return commission;
  }
}

// 4. API ROUTES
app.post('/api/payments/initialize', authenticate, requireIntern, async (req, res) => {
  try {
    const { registrationId, paidUserEmail, amount, paidUserId } = req.body;
    
    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email: paidUserEmail, amount: amount * 100, metadata: { registrationId, internId: req.user.id, paidUserId } },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const { authorization_url, reference } = paystackRes.data.data;

    await Transaction.create({
      registrationId, internId: req.user.id, paidUserId,
      amount, commission: amount * COMMISSION_RATE,
      paystackRef: reference,
    });

    res.json({ authorization_url, reference });
  } catch (err) {
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

app.get('/api/commissions/balance', authenticate, requireIntern, async (req, res) => {
  const redis = await getRedisClient();
  const balance = await redis.get(KEYS.internBalance(req.user.id));
  res.json({ balance: parseFloat(balance || '0').toFixed(2) });
});

app.get('/health', (_, res) => res.json({ service: 'payment-service', status: 'OK', port: PORT }));

// 5. START SERVER
const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => console.log(`\n💰 Payment Service: http://localhost:${PORT}`));
  } catch (err) {
    console.error('Unable to start Payment Service:', err);
  }
};

start();