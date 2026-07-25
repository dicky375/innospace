import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import configs
import { sequelize, User, RefreshToken, Program, Registration, Transaction, Payout } from './config/db.js';
import { getRedisClient } from './config/redis.js';

// Import middleware
import { authenticate, requireAdmin, requireAffiliate } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// Import routes (we'll create these next)
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import programsRoutes from './routes/programs.routes.js';
import registrationsRoutes from './routes/registrations.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import payoutsRoutes from './routes/payouts.routes.js';
import commissionsRoutes from './routes/commissions.routes.js';
import configRoutes from './routes/config.routes.js';
import statsRoutes from './routes/stats.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ===================== CREATE UPLOADS DIRECTORY =====================
const uploadDir = path.join(__dirname, 'uploads', 'siws');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// ===================== MIDDLEWARE =====================
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(helmet());
app.use(morgan('combined'));
app.use(rateLimiter);

// ===== Webhook must be BEFORE express.json() =====
app.post('/api/webhook/paystack', express.raw({ type: 'application/json' }));

// ===== JSON middleware =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== Static files =====
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===================== HEALTH CHECK =====================
app.get('/health', async (req, res) => {
  const redisHealth = await getRedisClient() ? 'OK' : 'DISABLED';
  res.json({
    service: 'innospace-monolith',
    status: 'OK',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'OK',
    redis: redisHealth
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'Innospace Platform',
    status: 'running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production'
  });
});

// ===================== MOUNT ROUTES =====================
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/programs', programsRoutes);
app.use('/api/registrations', registrationsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/payouts', payoutsRoutes);
app.use('/api/commissions', commissionsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/stats', statsRoutes);

// ===== Webhook handler =====
app.post('/api/webhook/paystack', async (req, res) => {
  try {
    const { handleWebhook } = await import('./services/payment.service.js');
    await handleWebhook(req, res);
  } catch (err) {
    console.error('[WEBHOOK] Error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ===================== ERROR HANDLER =====================
app.use(errorHandler);

// ===================== START SERVER =====================
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync models (alter in development only)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synced (development mode)');
    } else {
      // In production, use migrations instead
      await sequelize.sync();
      console.log('✅ Database synced (production mode)');
    }

    // Test Redis connection (non-blocking)
    try {
      await getRedisClient();
    } catch (err) {
      console.warn('⚠️ Redis not available, running without cache');
    }

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 INNOSPACE MONOLITH`);
      console.log(`=================================`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
      console.log(`🔄 Redis: ${await getRedisClient() ? 'Connected' : 'Not configured'}`);
      console.log(`=================================\n`);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

startServer();

export default app;