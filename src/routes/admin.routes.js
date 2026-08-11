import sequelize from '../config/db.js';
import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { Registration, Program, User, Transaction } from '../config/db.js';
import { getRedisClient, KEYS } from '../config/redis.js';
import { Op } from 'sequelize';

const router = Router();

// ===== GET ADMIN DASHBOARD STATS =====
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN] 📊 Fetching admin stats...');

    // Get registrations count
    const totalRegistrations = await Registration.count();
    const pendingRegistrations = await Registration.count({ 
      where: { status: 'pending_approval' } 
    });
    const approvedRegistrations = await Registration.count({ 
      where: { status: 'approved' } 
    });
    const paidRegistrations = await Registration.count({ 
      where: { status: 'paid' } 
    });
    const rejectedRegistrations = await Registration.count({ 
      where: { status: 'rejected' } 
    });

    // ✅ Calculate total revenue from ALL registrations
    const revenueResult = await Registration.sum('amount');
    const totalRevenue = revenueResult || 0;

    // ✅ Calculate total commissions from ALL registrations with commission > 0
    const commissionResult = await Registration.sum('commissionEarned');
    const totalCommissions = commissionResult || 0;

    // ✅ Calculate platform revenue
    const platformRevenue = totalRevenue - totalCommissions;

    // Get active programs count
    const activePrograms = await Program.count({ 
      where: { isActive: true } 
    });

    // Get total affiliates count
    const totalAffiliates = await User.count({ 
      where: { role: 'affiliate' } 
    });

    console.log('[ADMIN] ✅ Stats fetched:', {
      totalRegistrations,
      pendingRegistrations,
      totalRevenue,
      totalCommissions,
      platformRevenue,
      activePrograms,
      totalAffiliates
    });

    res.json({
      success: true,
      stats: {
        registrations: {
          total: totalRegistrations,
          pending: pendingRegistrations,
          approved: approvedRegistrations,
          paid: paidRegistrations,
          rejected: rejectedRegistrations
        },
        programs: {
          active: activePrograms,
          total: await Program.count()
        },
        affiliates: {
          total: totalAffiliates
        },
        revenue: {
          total: totalRevenue,
          commissions: totalCommissions,
          platformRevenue: platformRevenue
        }
      }
    });
  } catch (err) {
    console.error('[ADMIN] Stats error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch admin stats'
    });
  }
});

// ===== GET REVENUE SUMMARY =====
router.get('/revenue', authenticate, requireAdmin, async (req, res) => {
  try {
    // Total revenue
    const totalRevenue = await Registration.sum('amount') || 0;

    // Total commissions
    const totalCommissions = await Registration.sum('commissionEarned') || 0;

    // Admin/platform revenue
    const platformRevenue = totalRevenue - totalCommissions;

    // Revenue by program
    const revenueByProgram = await Registration.findAll({
      attributes: [
        'programId',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { status: 'paid' },
      include: [
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'title']
        }
      ],
      group: ['programId', 'program.id', 'program.title']
    });

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalCommissions,
        platformRevenue,
        revenueByProgram
      }
    });
  } catch (err) {
    console.error('[ADMIN] Revenue error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch revenue data'
    });
  }
});

// ===== GET REGISTRATIONS (Admin) =====
router.get('/registrations', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    if (status) {
      where.status = status;
    }

    const registrations = await Registration.findAll({
      where,
      include: [
        { 
          model: Program, 
          as: 'program',
          attributes: ['id', 'title', 'type', 'price', 'commissionRate']
        },
        { 
          model: User, 
          as: 'affiliate',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await Registration.count({ where });

    res.json({
      success: true,
      count: registrations.length,
      total,
      registrations
    });
  } catch (err) {
    console.error('[ADMIN] Registrations error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch registrations'
    });
  }
});

// ===== GET AFFILIATES (Admin) =====
router.get('/affiliates', authenticate, requireAdmin, async (req, res) => {
  try {
    const affiliates = await User.findAll({
      where: { role: 'affiliate' },
      attributes: ['id', 'name', 'email', 'phone', 'referralCode', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // Get commission totals for each affiliate
    const affiliateData = await Promise.all(
      affiliates.map(async (affiliate) => {
        const totalCommission = await Registration.sum('commissionEarned', {
          where: { affiliateId: affiliate.id }
        }) || 0;

        const registrationsCount = await Registration.count({
          where: { affiliateId: affiliate.id }
        });

        return {
          ...affiliate.toJSON(),
          totalCommission,
          registrationsCount
        };
      })
    );

    res.json({
      success: true,
      count: affiliateData.length,
      affiliates: affiliateData
    });
  } catch (err) {
    console.error('[ADMIN] Affiliates error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch affiliates'
    });
  }
});

// ===== GET AFFILIATE DETAILS (Admin) =====
router.get('/affiliates/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const affiliate = await User.findByPk(id, {
      attributes: ['id', 'name', 'email', 'phone', 'referralCode', 'isActive', 'createdAt']
    });

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    // Get commission totals
    const totalCommission = await Registration.sum('commissionEarned', {
      where: { affiliateId: affiliate.id }
    }) || 0;

    const registrations = await Registration.findAll({
      where: { affiliateId: affiliate.id },
      include: [
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'title', 'price']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Get balance from Redis
    let balance = 0;
    try {
      const redis = await getRedisClient();
      if (redis) {
        const balanceStr = await redis.get(KEYS.affiliateBalance(affiliate.id));
        balance = parseFloat(balanceStr || '0');
      }
    } catch (redisErr) {
      console.warn('[ADMIN] Redis error:', redisErr.message);
    }

    res.json({
      success: true,
      affiliate: {
        ...affiliate.toJSON(),
        totalCommission,
        balance,
        registrationsCount: registrations.length,
        registrations
      }
    });
  } catch (err) {
    console.error('[ADMIN] Affiliate details error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch affiliate details'
    });
  }
});

// ===== ONE-TIME: Credit all existing commissions to Redis =====
router.post('/credit-commissions', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN] 🔄 Starting commission credit...');
    const redis = await getRedisClient();
    if (!redis) {
      console.error('[ADMIN] ❌ Redis not available');
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Get all registrations with commission > 0
    const registrations = await Registration.findAll({
      where: {
        commissionEarned: { [Op.gt]: 0 }
      }
    });

    console.log(`[ADMIN] 📊 Found ${registrations.length} registrations with commissions`);

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
        console.log(`[ADMIN] ✅ Credited ₦${commission} to ${reg.affiliateId}`);
      }
    }

    console.log(`[ADMIN] ✅ Total credited: ₦${credited.toFixed(2)}`);

    res.json({
      success: true,
      message: `Credited ₦${credited.toFixed(2)} total commission to ${results.length} registrations`,
      total: credited.toFixed(2),
      count: results.length,
      results
    });
  } catch (err) {
    console.error('[ADMIN] Credit commissions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== SET AFFILIATE BALANCE (Admin) =====
router.post('/set-balance', authenticate, requireAdmin, async (req, res) => {
  try {
    const { affiliateId, balance } = req.body;
    
    if (!affiliateId || balance === undefined) {
      return res.status(400).json({
        success: false,
        error: 'affiliateId and balance are required'
      });
    }

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
    console.error('[ADMIN] Set balance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== GET AFFILIATE BALANCE (Admin) =====
router.get('/balance/:affiliateId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const redis = await getRedisClient();
    
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    const balance = await redis.get(KEYS.affiliateBalance(affiliateId));
    
    res.json({
      success: true,
      affiliateId,
      balance: parseFloat(balance || 0)
    });
  } catch (err) {
    console.error('[ADMIN] Get balance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== GET AFFILIATE COMMISSION HISTORY (Admin) =====
router.get('/commission-history/:affiliateId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { affiliateId } = req.params;
    
    const registrations = await Registration.findAll({
      where: {
        affiliateId,
        commissionEarned: { [Op.gt]: 0 }
      },
      include: [
        { 
          model: Program, 
          as: 'program',
          attributes: ['id', 'title', 'type', 'price']
        }
      ],
      order: [['approvedAt', 'DESC']]
    });

    res.json({
      success: true,
      affiliateId,
      count: registrations.length,
      registrations
    });
  } catch (err) {
    console.error('[ADMIN] Commission history error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;