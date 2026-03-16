require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createConnection } = require('../../shared/config/db');
const { authenticate } = require('../../shared/middleware/auth');

const app = express();
const PORT = process.env.SERVER1_PORT || 3001;

app.use(cors()); app.use(express.json()); app.use(morgan('dev'));

const db = createConnection(process.env.MONGO_URI_AUTH, 'Server1 (auth)');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },
  phone:      { type: String },
  role:       { type: String, enum: ['intern', 'user', 'admin'], default: 'user' },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = db.model('User', userSchema);

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email and password required' });

    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already registered' });

    const safeRole = role === 'intern' ? 'intern' : 'user';
    const user = await User.create({ name, email, password, phone, role: safeRole });
    res.status(201).json({ token: signToken(user), user: { id: user._id, name, email, role: safeRole } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive)
      return res.status(403).json({ error: 'Account deactivated' });
    res.json({ token: signToken(user), user: { id: user._id, name: user.name, email, role: user.role } });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/me
app.get('/api/users/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// GET /api/users/:id
app.get('/api/users/:id', authenticate, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/health', (_, res) => res.json({ server: 'server1-auth', status: 'ok' }));
app.listen(PORT, () => console.log(`[Server 1 — Auth] running on port ${PORT}`));