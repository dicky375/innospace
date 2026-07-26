import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getRedisClient, KEYS } from '../config/redis.js';

const router = Router();

// ===== GET COMMISSION RATE =====
router.get('/commission', authenticate, async (req, res) => {
  try {
    const redis = await getRedisClient();
    let rate = 10; // default 10%
    
    if (redis) {
      const stored = await redis.get('config:commission_rate');
      if (stored) {
        rate = parseFloat(stored) * 100;
      }
    }
    
    res.json({
      success: true,
      commissionRate: rate
    });
  } catch (err) {
    console.error('[CONFIG] Get commission error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission rate'
    });
  }
});

// ===== UPDATE COMMISSION RATE =====
router.patch('/commission', authenticate, requireAdmin, async (req, res) => {
  try {
    const { commissionRate } = req.body;
    
    if (commissionRate === undefined || isNaN(commissionRate)) {
      return res.status(400).json({
        success: false,
        error: 'commissionRate is required and must be a number'
      });
    }

    const rate = parseFloat(commissionRate);
    
    if (rate < 1 || rate > 50) {
      return res.status(400).json({
        success: false,
        error: 'Commission rate must be between 1% and 50%'
      });
    }

    const redis = await getRedisClient();
    if (redis) {
      // Store as decimal (e.g., 10% -> 0.10)
      await redis.set('config:commission_rate', (rate / 100).toString());
    }

    console.log(`[CONFIG] Commission rate updated to ${rate}%`);
    
    res.json({
      success: true,
      message: `Commission rate updated to ${rate}%`,
      commissionRate: rate
    });
  } catch (err) {
    console.error('[CONFIG] Update commission error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update commission rate'
    });
  }
});

export default router;