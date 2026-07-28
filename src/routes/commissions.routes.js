import { Router } from 'express';
import { authenticate, requireAffiliate } from '../middleware/auth.js';
import { getRedisClient, KEYS } from '../config/redis.js';
import { User } from '../config/db.js';

const router = Router();

// ===== GET AFFILIATE BALANCE =====
router.get('/balance', authenticate, requireAffiliate, async (req, res) => {
  try {
    const redis = await getRedisClient();
    let balance = 0;
    
    if (redis) {
      const balanceStr = await redis.get(KEYS.affiliateBalance(req.user.id));
      balance = balanceStr ? parseFloat(balanceStr) : 0;
    }
    
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
    const redis = await getRedisClient();
    let leaderboard = [];
    
    if (redis) {
      const results = await redis.zrevrange(KEYS.leaderboard(), 0, limit - 1, 'WITHSCORES');
      
      // Get all affiliate IDs from the leaderboard
      const affiliateIds = [];
      const commissionMap = {};
      
      for (let i = 0; i < results.length; i += 2) {
        const affiliateId = results[i];
        const commission = parseFloat(results[i + 1]);
        affiliateIds.push(affiliateId);
        commissionMap[affiliateId] = commission;
      }
      
      // Fetch user details for all affiliates
      const users = await User.findAll({
        where: { id: affiliateIds },
        attributes: ['id', 'name', 'email', 'phone']
      });
      
      // Create a map of user details by ID
      const userMap = {};
      users.forEach(user => {
        userMap[user.id] = {
          name: user.name,
          email: user.email,
          phone: user.phone
        };
      });
      
      // Build the leaderboard with user details
      let rank = 1;
      for (const affiliateId of affiliateIds) {
        const user = userMap[affiliateId];
        leaderboard.push({
          affiliateId: affiliateId,
          affiliateName: user?.name || `Affiliate ${affiliateId.slice(0, 8)}`,
          affiliateEmail: user?.email || null,
          totalCommission: commissionMap[affiliateId].toFixed(2),
          rank: rank++
        });
      }
    }
    
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

export default router;