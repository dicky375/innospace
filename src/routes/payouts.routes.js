import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { Payout } from '../config/db.js';

const router = Router();


// ===== GET PENDING PAYOUTS (Admin) =====
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const payouts = await Payout.findAll({
      where: { status: 'pending' },
      include: [{ model: User, as: 'affiliate', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'ASC']]
    });

    // Disable caching
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
      error: 'Failed to fetch pending payouts'
    });
  }
});
// ===== GET ALL PAYOUTS (Admin) =====
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const payouts = await Payout.findAll({
      order: [['createdAt', 'DESC']]
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
      error: 'Failed to fetch payouts'
    });
  }
});

export default router;