import { Router } from 'express';
import { authenticate, requireAffiliate } from '../middleware/auth.js';
import { 
  getAffiliateBalance, 
  getLeaderboard,
  getCommissionRate 
} from '../services/commission.service.js';

import { noCache, shortCache, mediumCache, longCache } from '../middleware/cache.js';

const router = Router();

// ===== GET AFFILIATE BALANCE =====
router.get('/balance', authenticate, requireAffiliate, async (req, res) => {
  try {
    const balance = await getAffiliateBalance(req.user.id);
    res.json({
      success: true,
      balance: balance.toFixed(2),
      currency: 'NGN'
    });
  } catch (err) {
    console.error('[COMMISSIONS] Balance error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance'
    });
  }
});

// ===== GET LEADERBOARD =====
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await getLeaderboard(limit);
    res.json({
      success: true,
      leaderboard
    });
  } catch (err) {
    console.error('[COMMISSIONS] Leaderboard error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

// ===== GET COMMISSION RATE (Admin) =====
router.get('/rate', authenticate, async (req, res) => {
  try {
    const rate = await getCommissionRate();
    res.json({
      success: true,
      commissionRate: (rate * 100).toFixed(1),
      rate: rate
    });
  } catch (err) {
    console.error('[COMMISSIONS] Rate error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission rate'
    });
  }
});

export default router;
