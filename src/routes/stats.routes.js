import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { Registration, Program, User } from '../config/db.js';
import { getCommissionRate } from '../services/commission.service.js';

const router = Router();

// ===== ADMIN STATS =====
router.get('/admin', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('[STATS] Fetching admin stats...');
    
    // Get all counts in parallel
    const [
      totalRegistrations,
      pendingRegistrations,
      approvedRegistrations,
      paidRegistrations,
      rejectedRegistrations,
      totalRevenue,
      totalCommissions,
      totalPrograms,
      totalAffiliates
    ] = await Promise.all([
      Registration.count(),
      Registration.count({ where: { status: 'pending_approval' } }),
      Registration.count({ where: { status: 'approved' } }),
      Registration.count({ where: { status: 'paid' } }),
      Registration.count({ where: { status: 'rejected' } }),
      Registration.sum('amount', { where: { status: 'paid' } }),
      Registration.sum('commission_earned', { where: { status: 'paid' } }),
      Program.count({ where: { isActive: true } }),
      User.count({ where: { role: 'affiliate', isActive: true } })
    ]);

    const commissionRate = await getCommissionRate();

    // Get recent registrations
    const recentRegistrations = await Registration.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'studentName', 'studentEmail', 'course', 'status', 'amount', 'commissionEarned', 'createdAt']
    });

    // Disable caching completely - let frontend handle it
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      stats: {
        registrations: {
          total: totalRegistrations || 0,
          pending: pendingRegistrations || 0,
          approved: approvedRegistrations || 0,
          paid: paidRegistrations || 0,
          rejected: rejectedRegistrations || 0
        },
        revenue: {
          total: parseFloat(totalRevenue || 0).toFixed(2),
          totalCommissions: parseFloat(totalCommissions || 0).toFixed(2)
        },
        programs: {
          active: totalPrograms || 0
        },
        users: {
          affiliates: totalAffiliates || 0
        },
        commissionRate: (commissionRate * 100).toFixed(1),
        recentRegistrations: recentRegistrations || []
      }
    });
  } catch (err) {
    console.error('[STATS] Admin error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch admin stats'
    });
  }
});

export default router;