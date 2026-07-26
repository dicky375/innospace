import { Router } from 'express';
import { authenticate, requireAdmin, requireAffiliate } from '../middleware/auth.js';
import { Payout } from '../config/db.js';
import { getRedisClient, KEYS } from '../config/redis.js';

const router = Router();

// ===== GET PENDING PAYOUTS (Admin) =====
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const payouts = await Payout.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']]
    });

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      count: payouts.length,
      payouts
    });
  } catch (err) {
    console.error('[PAYOUTS] Pending error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch pending payouts'
    });
  }
});

// ===== GET ALL PAYOUTS (Admin) =====
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const payouts = await Payout.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      count: payouts.length,
      payouts
    });
  } catch (err) {
    console.error('[PAYOUTS] All error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch payouts'
    });
  }
});

// ===== GET MY PAYOUTS (Affiliate) =====
router.get('/my', authenticate, requireAffiliate, async (req, res) => {
  try {
    const payouts = await Payout.findAll({
      where: { affiliateId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: payouts.length,
      payouts
    });
  } catch (err) {
    console.error('[PAYOUTS] My error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch payouts'
    });
  }
});

// ===== REQUEST PAYOUT (Affiliate) =====
router.post('/request', authenticate, requireAffiliate, async (req, res) => {
  try {
    const { amount, bankName, accountNumber, accountName, note } = req.body;

    if (!amount || !bankName || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        error: 'amount, bankName, accountNumber and accountName are required'
      });
    }

    const redis = await getRedisClient();
    const balance = redis ? parseFloat(await redis.get(KEYS.affiliateBalance(req.user.id)) || '0') : 0;
    
    if (amount > balance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Available: ₦${balance.toFixed(2)}`
      });
    }

    const pendingPayout = await Payout.findOne({
      where: { affiliateId: req.user.id, status: 'pending' }
    });
    
    if (pendingPayout) {
      return res.status(409).json({
        success: false,
        error: 'You already have a pending payout request'
      });
    }

    const payout = await Payout.create({
      affiliateId: req.user.id,
      amount,
      bankName,
      accountNumber,
      accountName,
      note: note || null,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Payout request submitted — pending admin approval',
      payout
    });
  } catch (err) {
    console.error('[PAYOUTS] Request error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to submit payout request'
    });
  }
});

// ===== APPROVE PAYOUT (Admin) =====
router.patch('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const payout = await Payout.findByPk(req.params.id);
    
    if (!payout) {
      return res.status(404).json({
        success: false,
        error: 'Payout not found'
      });
    }
    
    if (payout.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve — status is ${payout.status}`
      });
    }

    const redis = await getRedisClient();
    const balance = redis ? parseFloat(await redis.get(KEYS.affiliateBalance(payout.affiliateId)) || '0') : 0;
    
    if (parseFloat(payout.amount) > balance) {
      return res.status(400).json({
        success: false,
        error: 'Affiliate balance is insufficient for this payout'
      });
    }

    if (redis) {
      await redis.incrbyfloat(KEYS.affiliateBalance(payout.affiliateId), -parseFloat(payout.amount));
    }

    await payout.update({
      status: 'approved',
      processedBy: req.user.id,
      processedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Payout approved and balance deducted',
      payout
    });
  } catch (err) {
    console.error('[PAYOUTS] Approve error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to approve payout'
    });
  }
});

// ===== REJECT PAYOUT (Admin) =====
router.patch('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const payout = await Payout.findByPk(req.params.id);
    
    if (!payout) {
      return res.status(404).json({
        success: false,
        error: 'Payout not found'
      });
    }
    
    if (payout.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject — status is ${payout.status}`
      });
    }

    await payout.update({
      status: 'rejected',
      rejectionReason: reason || null,
      processedBy: req.user.id,
      processedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Payout rejected',
      payout
    });
  } catch (err) {
    console.error('[PAYOUTS] Reject error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to reject payout'
    });
  }
});

export default router;