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
import { sequelize } from './config/db.js';
import { getRedisClient } from './config/redis.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import programsRoutes from './routes/program.routes.js';
import registrationRoutes from './routes/registrations.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import statsRoutes from './routes/stats.routes.js';
import payoutRoutes from './routes/payouts.routes.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ===== CREATE UPLOADS DIRECTORY =====
const uploadDir = path.join(__dirname, 'uploads', 'siws');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// ===== MIDDLEWARE =====
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000'
]


app.use(cors({
 origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-service-secret']
}));
app.use(helmet());
app.use(morgan('combined'));

// ===== JSON middleware =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== Static files =====
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== HEALTH CHECK =====
app.get('/health', async (req, res) => {
  res.json({
    service: 'innospace-monolith',
    status: 'OK',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'Innospace Platform',
    status: 'running',
    version: '1.0.0'
  });
});

// ===== MOUNT ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/programs', programsRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/payouts', paymentsRoutes);

// ===== TEST ROUTE =====
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// ===== ERROR HANDLER =====
app.use(errorHandler);

// ===== START SERVER =====
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    try {
      await getRedisClient();
      console.log('✅ Redis connected');
    } catch (err) {
      console.warn('⚠️ Redis not available');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 INNOSPACE MONOLITH`);
      console.log(`=================================`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`=================================\n`);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

startServer();

export default app;