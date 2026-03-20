import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { DataTypes } from 'sequelize';
import { createConnection } from '../../shared/config/db.js';
import { authenticate, requireIntern } from '../../shared/config/middleware/auth.js';
import { getRedisClient, KEYS } from '../../shared/config/redis.js';

const app = express();
const PORT = process.env.SERVER2_PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const sequelize = createConnection({
  name: process.env.DB_REG_NAME,
  user: process.env.DB_REG_USER,
  pass: process.env.DB_REG_PASS,
  host: process.env.DB_REG_HOST,
  port: process.env.DB_REG_PORT,
}, 'Server2 (registration)');

const Program = sequelize.define('Program', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title:       { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  price:       { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  duration:    { type: DataTypes.STRING },
  category:    { type: DataTypes.STRING },
  isActive:    { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, { tableName: 'programs', underscored: true });

const Registration = sequelize.define('Registration', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  programId:        { type: DataTypes.UUID, allowNull: false, field: 'program_id' },
  registeredUserId: { type: DataTypes.UUID, allowNull: false, field: 'registered_user_id' },
  internId:         { type: DataTypes.UUID, allowNull: false, field: 'intern_id' },
  status:           { type: DataTypes.ENUM('pending', 'paid', 'cancelled'), defaultValue: 'pending' },
  paystackRef:      { type: DataTypes.STRING, field: 'paystack_ref' },
  commissionPaid:   { type: DataTypes.BOOLEAN, defaultValue: false, field: 'commission_paid' },
  amount:           { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, { tableName: 'registrations', underscored: true });

Program.hasMany(Registration, { foreignKey: 'program_id' });
Registration.belongsTo(Program, { foreignKey: 'program_id' });

await sequelize.sync({ alter: true });

// GET /api/programs
app.get('/api/programs', async (req, res) => {
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(KEYS.programs());
    if (cached) return res.json({ source: 'cache', programs: JSON.parse(cached) });
    const programs = await Program.findAll({ where: { isActive: true } });
    await redis.set(KEYS.programs(), JSON.stringify(programs), 'EX', 300);
    res.json({ source: 'db', programs });
  } catch (err) {
    console.error(err);
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
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/registrations
app.post('/api/registrations', authenticate, requireIntern, async (req, res) => {
  try {
    const internId = req.user.id;
    const { programId, registeredUserId } = req.body;
    if (!programId || !registeredUserId)
      return res.status(400).json({ error: 'programId and registeredUserId required' });
    if (internId === registeredUserId)
      return res.status(403).json({ error: 'Interns cannot register themselves' });
    const program = await Program.findByPk(programId);
    if (!program || !program.isActive)
      return res.status(404).json({ error: 'Program not found or inactive' });
    const duplicate = await Registration.findOne({
      where: { programId, registeredUserId, status: ['pending', 'paid'] },
    });
    if (duplicate)
      return res.status(409).json({ error: 'User already registered for this program' });
    const registration = await Registration.create({
      programId, registeredUserId, internId, amount: program.price,
    });
    res.status(201).json({
      message: 'Registration created — proceed to payment',
      registration,
      paymentRequired: program.price,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/registrations/my
app.get('/api/registrations/my', authenticate, requireIntern, async (req, res) => {
  try {
    const registrations = await Registration.findAll({
      where: { internId: req.user.id },
      include: [{ model: Program }],
    });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/registrations/:id/mark-paid
app.patch('/api/registrations/:id/mark-paid', async (req, res) => {
  try {
    const reg = await Registration.findByPk(req.params.id);
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    await reg.update({ status: 'paid', paystackRef: req.body.paystackRef });
    res.json(reg);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', (_, res) => res.json({ server: 'server2-registration', status: 'ok' }));
app.listen(PORT, () => console.log(`[Server 2 — Registration] running on port ${PORT}`));