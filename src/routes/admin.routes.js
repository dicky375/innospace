import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { Registration } from '../config/db.js';
import { getRedisClient, KEYS } from '../config/redis.js';
import { Op } from 'sequelize';

const router = Router();

// ===== ONE-TIME: Credit all existing commissions to Redis =====
router.post('/credit-commissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Get all approved registrations with commission > 0
    const registrations = await Registration.findAll({
      where: {
        status: 'approved',
        commissionEarned: { [Op.gt]: 0 }
      }
    });

    let credited = 0;
    const results = [];

    for (const reg of registrations) {
      const commission = parseFloat(reg.commissionEarned);
      if (commission > 0 && reg.affiliateId) {
        await redis.incrbyfloat(
          KEYS.affiliateBalance(reg.affiliateId),
          commission
        );
        await redis.zincrby(
          KEYS.leaderboard(),
          commission,
          reg.affiliateId
        );
        credited += commission;
        results.push({
          registrationId: reg.id,
          affiliateId: reg.affiliateId,
          studentName: reg.studentName,
          commission: commission
        });
      }
    }

    res.json({
      success: true,
      message: `Credited ₦${credited.toFixed(2)} total commission to ${results.length} registrations`,
      results
    });
  } catch (err) {
    console.error('[ADMIN] Credit commissions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== SET BALANCE =====
router.post('/set-balance', authenticate, requireAdmin, async (req, res) => {
  try {
    const { affiliateId, balance } = req.body;
    const redis = await getRedisClient();
    
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    await redis.set(KEYS.affiliateBalance(affiliateId), balance.toString());
    
    res.json({
      success: true,
      message: `Set balance to ₦${balance} for affiliate ${affiliateId}`,
      affiliateId,
      balance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;