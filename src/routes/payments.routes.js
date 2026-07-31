import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { authenticate, requireAffiliate, requireAdmin } from '../middleware/auth.js';
import { Transaction, Registration } from '../config/db.js';
import { getRedisClient, KEYS } from '../config/redis.js';
import { getCommissionRate } from '../services/commission.service.js';

const router = Router();

// ===== PROCESS SUCCESSFUL PAYMENT =====
async function processSuccessfulPayment(reference, metadata, amount) {
  try {
    const transaction = await Transaction.findOne({
      where: { paystackRef: reference }
    });

    if (!transaction) {
      console.warn(`[PAY] Transaction not found for reference: ${reference}`);
      return;
    }

    if (transaction.paystackStatus === 'success') {
      console.log(`[PAY] Payment already processed for: ${reference}`);
      return;
    }

    const rate = await getCommissionRate();
    const commission = parseFloat((amount * rate).toFixed(2));

    // Update Redis
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.incrbyfloat(KEYS.affiliateBalance(metadata.affiliateId), commission);
        await redis.zincrby(KEYS.leaderboard(), commission, metadata.affiliateId);
        console.log(`[PAY] Redis updated: +₦${commission} for affiliate ${metadata.affiliateId}`);
      }
    } catch (redisErr) {
      console.warn('[PAY] Redis update failed:', redisErr.message);
    }

    // Update transaction
    await transaction.update({
      paystackStatus: 'success',
      commission: commission,
      commissionCredited: true
    });

    // Update registration
    const registration = await Registration.findByPk(metadata.registrationId);
    if (registration && registration.status === 'approved') {
      await registration.update({
        status: 'paid',
        paystackRef: reference
      });
      console.log(`[PAY] Registration ${metadata.registrationId} marked as paid`);
    }

    console.log(`✅ Payment processed: ₦${amount} | Commission: ₦${commission}`);
  } catch (err) {
    console.error('[PAY] Payment processing failed:', err.message);
  }
}

// ===== INITIALIZE PAYMENT =====
router.post('/initialize', authenticate, requireAffiliate, async (req, res) => {
  try {
    const { registrationId, paidUserEmail, amount } = req.body;

    if (!registrationId || !paidUserEmail || !amount) {
      return res.status(400).json({
        success: false,
        error: 'registrationId, paidUserEmail and amount are required'
      });
    }

    const registration = await Registration.findByPk(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }

    if (registration.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: `Registration must be approved before payment. Current status: ${registration.status}`
      });
    }

    // Check for existing payment
    const existing = await Transaction.findOne({
      where: {
        registrationId,
        paystackStatus: { [Op.in]: ['pending', 'success'] }
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Payment already initialized for this registration'
      });
    }

    // Call Paystack API
    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: paidUserEmail,
        amount: Math.round(amount * 100),
        metadata: {
          registrationId,
          affiliateId: req.user.id
        },
        callback_url: process.env.PAYSTACK_CALLBACK_URL || 'http://localhost:5173/payment/verify'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!paystackRes.data.status) {
      throw new Error(paystackRes.data.message || 'Paystack initialization failed');
    }

    const { authorization_url, reference } = paystackRes.data.data;

    // Create transaction record
    const transaction = await Transaction.create({
      registrationId,
      affiliateId: req.user.id,
      paidUserEmail,
      amount,
      commission: 0,
      paystackRef: reference,
      paystackStatus: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        authorization_url,
        reference,
        transaction
      }
    });

  } catch (err) {
    console.error('[PAY] Initialize error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data?.message || 'Failed to initialize payment'
    });
  }
});

// ===== VERIFY PAYMENT =====
router.get('/verify/:reference', authenticate, async (req, res) => {
  try {
    const { reference } = req.params;

    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (!paystackRes.data.status) {
      return res.status(400).json({
        success: false,
        error: paystackRes.data.message || 'Verification failed'
      });
    }

    const { status, amount, metadata } = paystackRes.data.data;

    if (status === 'success') {
      await processSuccessfulPayment(reference, metadata, amount / 100);
      return res.json({
        success: true,
        message: 'Payment verified and processed successfully',
        status: 'success'
      });
    }

    res.json({
      success: false,
      message: 'Payment not successful',
      status
    });

  } catch (err) {
    console.error('[PAY] Verify error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data?.message || 'Failed to verify payment'
    });
  }
});

// ===== GET TRANSACTIONS (Affiliate) =====
router.get('/transactions', authenticate, requireAffiliate, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { affiliateId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    console.error('[PAY] Transactions error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

// ===== GET ALL TRANSACTIONS (Admin) =====
router.get('/transactions/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    console.error('[PAY] All transactions error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

// In the initialize payment endpoint, allow pending_approval status
if (registration.status !== 'pending_approval' && registration.status !== 'approved') {
  return res.status(400).json({
    success: false,
    error: `Registration must be pending or approved before payment. Current status: ${registration.status}`
  });
}
export default router;