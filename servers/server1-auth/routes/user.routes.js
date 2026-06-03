import { Router } from 'express';
import { authenticate, requireAdmin } from '../../../middleware/auth.js';

const router = Router();

export default (User) => {

  // GET /api/users/me
  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/users/profile — affiliate updates profile and bank details
  router.patch('/profile', authenticate, async (req, res) => {
    try {
      const { name, phone, bankName, accountNumber, accountName } = req.body;
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      await user.update({
        name: name || user.name,
        phone: phone || user.phone,
        bankName: bankName || user.bankName,
        accountNumber: accountNumber || user.accountNumber,
        accountName: accountName || user.accountName,
      });

      res.json({
        message: 'Profile updated',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          bankName: user.bankName,
          accountNumber: user.accountNumber,
          accountName: user.accountName,
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/users/:id/deactivate — admin deactivates affiliate
  router.patch('/:id/deactivate', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      await user.update({ isActive: false });
      res.json({ message: 'User deactivated' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/users/:id/activate — admin activates affiliate
  router.patch('/:id/activate', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      await user.update({ isActive: true });
      res.json({ message: 'User activated' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/users/:id — must be last to avoid catching /me and /profile
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};