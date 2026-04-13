import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';
import axios from 'axios';
import { DataTypes } from 'sequelize';

import { createConnection } from '../../../shared/config/db.js';
import { authenticate, requireAffiliate } from '../../../middleware/auth.js';
import { getRedisClient, KEYS } from '../../../shared/config/redis.js';

const app = express();
// Force 3003 if the env isn't loading correctly
const PORT = process.env.SERVER3_PORT || 3003;
const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.05');
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

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
  affiliateId:           { type: DataTypes.UUID, allowNull: false, field: 'affiliate_id' },
  paidUserId:         { type: DataTypes.UUID, allowNull: false, field: 'paid_user_id' },
  amount:             { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  commission:         { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  paystackRef:        { type: DataTypes.STRING, unique: true, field: 'paystack_ref' },
  paystackStatus:     { type: DataTypes.ENUM('pending', 'success', 'failed'), defaultValue: 'pending', field: 'paystack_status' },
  commissionCredited: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'commission_credited' },
}, { tableName: 'transactions', underscored: true });

app.use(cors());
// Webhook must come BEFORE express.json() if you use express.raw()
app.post('/api/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
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
      await processSuccessfulPayment(reference, metadata.affiliateId, amount / 100, metadata.registrationId);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("[PAY] Webhook Error:", err.message);
    res.sendStatus(500);
  }
});

app.use(express.json());
app.use(morgan('dev'));

async function processSuccessfulPayment(reference, affiliateId, amount, registrationId) {
  try {
    const txn = await Transaction.findOne({ where: { paystackRef: reference } });
    if (txn && !txn.commissionCredited) {
      const commission = parseFloat((amount * COMMISSION_RATE).toFixed(2));
      const redis = await getRedisClient();
      
      await Promise.all([
        redis.incrbyfloat(KEYS.affiliateBalance(affiliateId), commission),
        redis.zincrby(KEYS.leaderboard(), commission, affiliateId.toString())
      ]);

      await txn.update({ commissionCredited: true, paystackStatus: 'success', commission });

      const lbPort = process.env.LOAD_BALANCER_PORT || 3000;
      await axios.patch(`http://localhost:${lbPort}/api/registrations/${registrationId}/mark-paid`, {
        paystackRef: reference
      });
      
      return commission;
    }
  } catch (err) {
    console.error(`[PAY] Payment processing failed: ${err.message}`);
  }
}

app.post('/api/payments/initialize', authenticate, requireAffiliate, async (req, res) => {
  try {
    const { registrationId, paidUserEmail, amount, paidUserId } = req.body;
    
    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email: paidUserEmail, amount: amount * 100, metadata: { registrationId, affiliateId: req.user.id, paidUserId } },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const { authorization_url, reference } = paystackRes.data.data;

    await Transaction.create({
      registrationId, affiliateId: req.user.id, paidUserId,
      amount, commission: amount * COMMISSION_RATE,
      paystackRef: reference,
    });

    res.json({ authorization_url, reference });
  } catch (err) {
    console.error("[PAY] Init Error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

app.get('/api/commissions/balance', authenticate, requireAffiliate, async (req, res) => {
  try {
    const redis = await getRedisClient();
    const balance = await redis.get(KEYS.affiliateBalance(req.user.id));
    res.json({ balance: parseFloat(balance || '0').toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

app.get('/health', (_, res) => res.json({ service: 'payment-service', status: 'OK', port: PORT }));

const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => console.log(`\n💰 Payment Service: http://localhost:${PORT}`));
  } catch (err) {
    console.error('Unable to start Payment Service:', err);
    process.exit(1);
  }
};

start();