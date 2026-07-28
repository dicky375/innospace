import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { User } from '../config/db.js';

const router = Router();

// ============================================================
// GET /api/users - Get all users (Admin only)
// ============================================================
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('[USERS] Get all error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// ============================================================
// GET /api/users/profile - Get current user's profile
// ============================================================
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('[USERS] Profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// ============================================================
// PATCH /api/users/profile - Update current user's profile
// ============================================================
router.patch('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, bankName, accountNumber, accountName } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
    if (accountName !== undefined) updateData.accountName = accountName;

    await user.update(updateData);

    // Fetch updated user
    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('[USERS] Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// ============================================================
// GET /api/users/:id - Get user by ID
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('[USERS] Get by ID error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// ============================================================
// PATCH /api/users/:id - Update user (Admin only)
// ============================================================
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, isActive } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    await user.update(updateData);

    // Fetch updated user
    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('[USERS] Update error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// ============================================================
// PATCH /api/users/:id/deactivate - Deactivate user (Admin only)
// ============================================================
router.patch('/:id/deactivate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent deactivating yourself
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot deactivate your own account'
      });
    }

    await user.update({ isActive: false });

    return res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('[USERS] Deactivate error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to deactivate user'
    });
  }
});

// ============================================================
// PATCH /api/users/:id/activate - Activate user (Admin only)
// ============================================================
router.patch('/:id/activate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({ isActive: true });

    return res.status(200).json({
      success: true,
      message: 'User activated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('[USERS] Activate error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to activate user'
    });
  }
});

export default router;