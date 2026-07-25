import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, RefreshToken } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ===== HELPERS =====
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '1d' }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
  
  return { accessToken, refreshToken };
}

async function saveRefreshToken(userId, token) {
  await RefreshToken.create({
    token,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
}

// ===== REGISTER =====
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password required' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      role: role || 'affiliate',
      isActive: true,
      referralCode: `REF-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`
    });

    const { accessToken, refreshToken } = generateTokens(user);
    await saveRefreshToken(user.id, refreshToken);

    res.status(201).json({
      message: 'Registration successful',
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[REGISTER] Error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ===== LOGIN =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await user.update({ lastLogin: new Date() });

    const { accessToken, refreshToken } = generateTokens(user);
    await saveRefreshToken(user.id, refreshToken);

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[LOGIN] Error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ===== REFRESH TOKEN =====
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await RefreshToken.findOne({
      where: { token: refreshToken, isRevoked: false }
    });

    if (!stored) {
      return res.status(401).json({ error: 'Refresh token not recognized or revoked' });
    }

    if (new Date() > stored.expiresAt) {
      await stored.update({ isRevoked: true });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const user = await User.findByPk(payload.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    await stored.update({ isRevoked: true });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await saveRefreshToken(user.id, newRefreshToken);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[REFRESH] Error:', err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

// ===== LOGOUT =====
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.update(
        { isRevoked: true },
        { where: { token: refreshToken } }
      );
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ===== GET CURRENT USER =====
// IMPORTANT: This MUST be before the /:id route
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('[ME] Error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ===== GET USER BY ID =====
// This must come AFTER /me to avoid conflicts
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('[USER] Error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;