import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { User } from '../config/db.js';

const router = Router();

// ===== GET ALL USERS (Admin only) =====
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    console.error('[USERS] Get all error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// ===== GET USER BY ID =====
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check permissions (users can only view their own profile unless admin)
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error('[USERS] Get by ID error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// ===== UPDATE USER (Admin only) =====
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, phone, role, isActive } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({
      name: name || user.name,
      phone: phone !== undefined ? phone : user.phone,
      role: role || user.role,
      isActive: isActive !== undefined ? isActive : user.isActive
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('[USERS] Update error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// ===== DEACTIVATE USER (Admin only) =====
router.patch('/:id/deactivate', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({ isActive: false });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (err) {
    console.error('[USERS] Deactivate error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate user'
    });
  }
});

// ===== ACTIVATE USER (Admin only) =====
router.patch('/:id/activate', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({ isActive: true });

    res.json({
      success: true,
      message: 'User activated successfully'
    });
  } catch (err) {
    console.error('[USERS] Activate error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to activate user'
    });
  }
});

export default router;