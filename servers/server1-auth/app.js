import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { createConnection } from '../shared/config/db.js';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';

const app = express();
const PORT = process.env.SERVER1_PORT || 3001;

const sequelize = createConnection({
  name: process.env.DB_AUTH_NAME,
  user: process.env.DB_AUTH_USER,
  pass: process.env.DB_AUTH_PASS,
  host: process.env.DB_AUTH_HOST,
  port: process.env.DB_AUTH_PORT,
}, 'Auth Service');

// ===================== MIDDLEWARE =====================
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));

// ===================== TOKEN GENERATOR =====================
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '1d' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// ===================== ROUTES =====================
app.get('/health', (_, res) => res.json({ service: 'auth-service', status: 'OK' }));

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (role !== 'admin' && role !== 'affiliate') {
      return res.status(400).json({ error: "Invalid role. Only admin or affiliate allowed." });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role,
      referralCode: role === 'affiliate' ? `AFF-${Date.now().toString(36)}` : null
    });

    const { accessToken, refreshToken } = generateTokens(user);

    await RefreshToken.create({
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.status(201).json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, isActive: true } });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const { accessToken, refreshToken } = generateTokens(user);

    await RefreshToken.create({
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await user.update({ lastLogin: new Date() });

    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🔐 Auth Service (Server 1) running on http://localhost:${PORT}`);
});