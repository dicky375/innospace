require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { createConnection } = require('../../shared/config/db');
const { authenticate, requireIntern } = require('../../shared/middleware/auth');
const { getRedisClient, KEYS } = require('../../shared/config/redis');

const app = express();
const PORT = process.env.SERVER2_PORT || 3002;

app.use(cors()); app.use(express.json()); app.use(morgan('dev'));

const db = createConnection(process.env.MONGO_URI_REGISTRATION, 'Server2 (registration)');

const programSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: String,
  price:       { type: Number, required: true },
  duration:    String,
  category:    String,
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

const registrationSchema = new mongoose.Schema({
  programId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  registeredUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
  internId:         { type: mongoose.Schema.Types.ObjectId, required: true },
  status:           { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  paystackRef:      { type: String },
  commissionPaid:   { type: Boolean, default: false },
  amount:           { type: Number, required: true },
}, { timestamps: true });

const Program = db.model('Program', programSchema);
const Registration = db.model('Registration', registrationSchema);

// GET /api/programs
app.get('/api/programs', async (req, res) => {
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(KEYS.programs());
    if (cached) return res.json({ source: 'cache', programs: JSON.parse(cached) });

    const programs = await Program.find({ isActive: true });
    await redis.setEx(KEYS.programs(), 300, JSON.stringify(programs));
    res.json({ source: 'db', programs });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/programs
app.post('/api/programs', authenticate, async (req, res) => {
  try {
    const { title, description, price, duration, category } = req.body;
    if (!title || !price) return res.status(400).json({ error: 'title and price required' });
    const program = await Program.create({ title, description, price, duration, category });
    const redis = await getRedisClient();
    await redis.del(KEYS.programs());
    res.status(201).json(program);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/registrations — intern registers someone else
app.post('/api/registrations', authenticate, requireIntern, async (req, res) => {
  try {
    const internId = req.user.id;
    const { programId, registeredUserId } = req.body;

    if (!programId || !registeredUserId)
      return res.status(400).json({ error: 'programId and registeredUserId required' });

    // 🚫 Self-registration guard
    if (internId === registeredUserId)
      return res.status(403).json({ error: 'Interns cannot register themselves — no commission for self-registration' });

    const program = await Program.findById(programId);
    if (!program || !program.isActive)
      return res.status(404).json({ error: 'Program not found or inactive' });

    const duplicate = await Registration.findOne({ programId, registeredUserId, status: { $ne: 'cancelled' } });
    if (duplicate)
      return res.status(409).json({ error: 'User already registered for this program' });

    const registration = await Registration.create({
      programId, registeredUserId, internId, amount: program.price, status: 'pending',
    });

    res.status(201).json({ message: 'Registration created — proceed to payment', registration, paymentRequired: program.price });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/registrations/my
app.get('/api/registrations/my', authenticate, requireIntern, async (req, res) => {
  const registrations = await Registration.find({ internId: req.user.id }).populate('programId');
  res.json(registrations);
});

// PATCH /api/registrations/:id/mark-paid — called by Server 3 after payment
app.patch('/api/registrations/:id/mark-paid', async (req, res) => {
  const reg = await Registration.findByIdAndUpdate(
    req.params.id,
    { status: 'paid', paystackRef: req.body.paystackRef },
    { new: true }
  );
  if (!reg) return res.status(404).json({ error: 'Registration not found' });
  res.json(reg);
});

app.get('/health', (_, res) => res.json({ server: 'server2-registration', status: 'ok' }));
app.listen(PORT, () => console.log(`[Server 2 — Registration] running on port ${PORT}`));