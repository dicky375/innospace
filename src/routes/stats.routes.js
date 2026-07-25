import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { Registration, Program, User, Transaction } from '../config/db.js';
import { getCommissionRate } from '../services/commission.service.js';

const router = Router();

// ===== ADMIN STATS =====
router.get('/admin', authenticate, requireAdmin, async (req, res) => {
  try {
    const [
      totalRegistrations,
      pendingRegistrations,
      approvedRegistrations,
      paidRegistrations,
      rejectedRegistrations,
      totalRevenue,
      totalCommissions,
      totalPrograms,
      totalAffiliates,
      totalAdmins
    ] = await Promise.all([
      Registration.count(),
      Registration.count({ where: { status: 'pending_approval' } }),
      Registration.count({ where: { status: 'approved' } }),
      Registration.count({ where: { status: 'paid' } }),
      Registration.count({ where: { status: 'rejected' } }),
      Registration.sum('amount', { where: { status: 'paid' } }),
      Registration.sum('commission_earned', { where: { status: 'paid' } }),
      Program.count({ where: { isActive: true } }),
      User.count({ where: { role: 'affiliate', isActive: true } }),
      User.count({ where: { role: 'admin', isActive: true } })
    ]);

    const commissionRate = await getCommissionRate();

    // Get recent registrations
    const recentRegistrations = await Registration.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Program, attributes: ['id', 'title', 'type'] },
        { model: User, as: 'affiliate', attributes: ['id', 'name', 'email'] }
      ]
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
        revenue: {
          total: parseFloat(totalRevenue || 0).toFixed(2),
          totalCommissions: parseFloat(totalCommissions || 0).toFixed(2)
        },
        programs: {
          active: totalPrograms
        },
        users: {
          affiliates: totalAffiliates,
          admins: totalAdmins,
          total: totalAffiliates + totalAdmins
        },
        commissionRate: (commissionRate * 100).toFixed(1),
        recentRegistrations
      }
    });
  } catch (err) {
    console.error('[STATS] Admin error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin stats'
    });
  }
});

// ===== AFFILIATE STATS =====
router.get('/affiliate', authenticate, requireAdmin, async (req, res) => {
  try {
    const affiliateId = req.user.id;

    const [
      total,
      pending,
      approved,
      paid,
      rejected,
      totalCommission
    ] = await Promise.all([
      Registration.count({ where: { affiliateId } }),
      Registration.count({ where: { affiliateId, status: 'pending_approval' } }),
      Registration.count({ where: { affiliateId, status: 'approved' } }),
      Registration.count({ where: { affiliateId, status: 'paid' } }),
      Registration.count({ where: { affiliateId, status: 'rejected' } }),
      Registration.sum('commission_earned', { 
        where: { affiliateId, status: 'paid' } 
      })
    ]);

    // Get recent registrations
    const recentRegistrations = await Registration.findAll({
      where: { affiliateId },
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Program, attributes: ['id', 'title', 'type'] }
      ]
    });

    res.json({
      success: true,
      stats: {
        total,
        pending,
        approved,
        paid,
        rejected,
        totalCommissionEarned: parseFloat(totalCommission || 0).toFixed(2),
        recentRegistrations
      }
    });
  } catch (err) {
    console.error('[STATS] Affiliate error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch affiliate stats'
    });
  }
});

export default router;