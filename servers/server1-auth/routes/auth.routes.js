import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {authenticate, requireAdmin} from '../../../middleware/auth.js';

const router = Router();

export default (User, RefreshToken) => {

  function signAccessToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
    );
  }

  function signRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
    );
  }

  async function saveRefreshToken(userId, token) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await RefreshToken.create({ token, userId, expiresAt });
  }

  // POST /api/auth/register
  router.post('/register', async (req, res) => {
    try {
      const { name, email, password, phone, role } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ error: 'name, email and password required' });

      const existing = await User.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const safeRole = role === 'intern' ? 'intern' : 'user';
      const user = await User.create({ name, email, password, phone, role: safeRole });

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      await saveRefreshToken(user.id, refreshToken);

      res.status(201).json({
        accessToken,
        refreshToken,
        user: { id: user.id, name, email, role: safeRole },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ error: 'Invalid credentials' });
      if (!user.isActive)
        return res.status(403).json({ error: 'Account deactivated' });

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      await saveRefreshToken(user.id, refreshToken);

      res.json({
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email, role: user.role },
      });
    } catch (err) {
      console.error('[LOGIN ERROR]', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/auth/refresh
  router.post('/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken)
        return res.status(400).json({ error: 'Refresh token required' });

      let payload;
      try {
        payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const stored = await RefreshToken.findOne({
        where: { token: refreshToken, isRevoked: false },
      });
      if (!stored)
        return res.status(401).json({ error: 'Refresh token not recognised or already revoked' });

      if (new Date() > stored.expiresAt) {
        await stored.update({ isRevoked: true });
        return res.status(401).json({ error: 'Refresh token expired — please log in again' });
      }

      const user = await User.findByPk(payload.id);
      if (!user || !user.isActive)
        return res.status(401).json({ error: 'User not found or deactivated' });

      // Rotate tokens
      await stored.update({ isRevoked: true });
      const newAccessToken = signAccessToken(user);
      const newRefreshToken = signRefreshToken(user);
      await saveRefreshToken(user.id, newRefreshToken);

      res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken)
        return res.status(400).json({ error: 'Refresh token required' });

      const stored = await RefreshToken.findOne({ where: { token: refreshToken } });
      if (stored) await stored.update({ isRevoked: true });

      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

// GET /api/users/by-email?email=xxx
router.get('/by-email', authenticate, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({
      where: { email },
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users — admin gets all users
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({ attributes: { exclude: ['password'] } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});



  return router;
};
