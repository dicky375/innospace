import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { authenticate, requireAdmin } from '../../../middleware/auth.js';

const router = Router();

export default (User, RefreshToken) => {

  function signAccessToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES || '1d' }
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

  // Sync new user to registration service so foreign key constraints work
  async function syncUserToRegistrationService(user) {
    try {
      const regPort = process.env.SERVER2_PORT || 3002;
      await axios.post(
        `http://localhost:${regPort}/api/internal/sync-user`,
        {
          id: user.id,
          name: user.name,
          email: user.email,
          password: user.password,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
        },
        {
          headers: { 'x-service-secret': process.env.INTERNAL_SERVICE_SECRET },
        }
      );
      console.log(`[AUTH] ✓ User synced to registration service: ${user.email}`);
    } catch (err) {
      // Don't fail registration if sync fails — log it and move on
      console.error(`[AUTH] ✗ Failed to sync user to registration service:`, err.message);
    }
  }

  // POST /api/auth/register
  router.post('/register', async (req, res) => {
    try {
      const { name, email, password, phone } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ error: 'name, email and password required' });

      const existing = await User.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        role: 'affiliate',
      });

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      await saveRefreshToken(user.id, refreshToken);

      // Sync user to registration service (non-blocking)
      syncUserToRegistrationService(user);

      res.status(201).json({
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
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

      await user.update({ lastLogin: new Date() });

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      await saveRefreshToken(user.id, refreshToken);

      res.json({
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
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

  // PATCH /api/users/profile — affiliate updates their profile and bank details
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

  // PATCH /api/users/:id/deactivate — admin deactivates an affiliate
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

  // PATCH /api/users/:id/activate — admin activates an affiliate
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

  return router;
};