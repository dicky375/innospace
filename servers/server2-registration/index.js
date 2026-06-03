import { authenticate, requireAdmin } from '../../middleware/auth.js';
import './env.js';
import { __dirname } from './env.js';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createConnection } from '../../shared/config/db.js';
import { getRedisClient } from '../../shared/config/redis.js';
import defineUser from '../../shared/models/User.js';
import defineProgram from './models/program.js';
import defineRegistration from './models/registration.js';
import programRoutes from './routes/program.routes.js';
import registrationRoutes from './routes/registration.routes.js';

const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
const PORT = process.env.SERVER2_PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadDir));

const COMMISSION_RATE_KEY = 'config:commission_rate';
const DEFAULT_COMMISSION_RATE = 0.10; // 10%

const startServer = async () => {
  try {
    const sequelize = createConnection({
      name: process.env.DB_REG_NAME,
      user: process.env.DB_REG_USER,
      pass: process.env.DB_REG_PASS,
      host: process.env.DB_REG_HOST,
      port: process.env.DB_REG_PORT,
    }, 'Server2 (registration)');

    const User = defineUser(sequelize);
    const Program = defineProgram(sequelize);
    const Registration = defineRegistration(sequelize);

    Program.hasMany(Registration, { foreignKey: 'program_id' });
    Registration.belongsTo(Program, { foreignKey: 'program_id' });
    Registration.belongsTo(User, { foreignKey: 'affiliate_id', as: 'affiliate' });

    // ── Routes ─────────────────────────────────────────────────
    app.use('/api/programs', programRoutes(Program));

    const regRouter = registrationRoutes(Registration, Program, User);
    app.use('/api/registrations', regRouter);
    app.use('/api/internal', regRouter);

    // ── GET /api/stats/admin ───────────────────────────────────
    app.get('/api/stats/admin', authenticate, requireAdmin, async (req, res) => {
      try {
        const [
          totalRegistrations,
          pendingRegistrations,
          approvedRegistrations,
          paidRegistrations,
          rejectedRegistrations,
          totalRevenue,
          totalCommissions,
          totalPrograms,
        ] = await Promise.all([
          Registration.count(),
          Registration.count({ where: { status: 'pending_approval' } }),
          Registration.count({ where: { status: 'approved' } }),
          Registration.count({ where: { status: 'paid' } }),
          Registration.count({ where: { status: 'rejected' } }),
          Registration.sum('amount', { where: { status: 'paid' } }),
          Registration.sum('commission_earned', { where: { status: 'paid' } }),
          Program.count({ where: { isActive: true } }),
        ]);

        // Get current commission rate from Redis
        const redis = await getRedisClient();
        const storedRate = await redis.get(COMMISSION_RATE_KEY);
        const commissionRate = storedRate ? parseFloat(storedRate) : DEFAULT_COMMISSION_RATE;

        res.json({
          registrations: {
            total: totalRegistrations,
            pending: pendingRegistrations,
            approved: approvedRegistrations,
            paid: paidRegistrations,
            rejected: rejectedRegistrations,
          },
          revenue: {
            total: parseFloat(totalRevenue || 0).toFixed(2),
            totalCommissions: parseFloat(totalCommissions || 0).toFixed(2),
          },
          programs: {
            active: totalPrograms,
          },
          commissionRate: (commissionRate * 100).toFixed(0), // return as percentage e.g. "10"
        });
      } catch (err) {
        console.error('[REG] Stats error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // ── GET /api/config/commission — get current rate ──────────
    app.get('/api/config/commission', authenticate, async (req, res) => {
      try {
        const redis = await getRedisClient();
        const storedRate = await redis.get(COMMISSION_RATE_KEY);
        const rate = storedRate ? parseFloat(storedRate) : DEFAULT_COMMISSION_RATE;
        res.json({ commissionRate: (rate * 100).toFixed(1) }); // e.g. "10.0"
      } catch (err) {
        res.status(500).json({ error: 'Server error' });
      }
    });

    // ── PATCH /api/config/commission — admin updates rate ──────
    app.patch('/api/config/commission', authenticate, requireAdmin, async (req, res) => {
      try {
        const { commissionRate } = req.body;

        if (commissionRate === undefined || isNaN(commissionRate))
          return res.status(400).json({ error: 'commissionRate is required and must be a number' });

        const rate = parseFloat(commissionRate);

        if (rate < 1 || rate > 50)
          return res.status(400).json({ error: 'Commission rate must be between 1% and 50%' });

        // Store as decimal e.g. 10% → 0.10
        const redis = await getRedisClient();
        await redis.set(COMMISSION_RATE_KEY, (rate / 100).toString());

        console.log(`[REG] Commission rate updated to ${rate}%`);
        res.json({
          message: `Commission rate updated to ${rate}%`,
          commissionRate: rate.toFixed(1),
        });
      } catch (err) {
        console.error('[REG] Commission rate update error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // ── Health & root ──────────────────────────────────────────
    app.get('/health', (_, res) =>
      res.json({ service: 'registration-service', status: 'UP' })
    );
    app.get('/', (req, res) =>
      res.json({ service: 'Registration Service', status: 'running', port: PORT })
    );

    await sequelize.authenticate();
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });

    app.listen(PORT, () => {
      console.log(`\n📋 REGISTRATION SERVICE ACTIVE`);
      console.log(`-----------------------------------`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`DB:  ${process.env.DB_REG_NAME}`);
      console.log(`-----------------------------------\n`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};

startServer();