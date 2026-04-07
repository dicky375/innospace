import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';

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

  // GET /api/users/:id
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