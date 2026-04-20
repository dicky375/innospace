import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Import the connection
import { sequelize } from '../shared/config/db.js'; 
import { authenticate, requireAffiliate, requireAdmin } from '../middleware/auth.js';
import { setupAssociations } from '../models/associations.js';

// 2. Import the Model Factories
import UserFactory from '../../shared/models/User.js'; 
import ProgramFactory from '../../shared/models/Program.js';
import RegistrationFactory from '../../shared/models/Registration.js';

// 3. Initialize Models for this specific Sequelize instance
const User = UserFactory(sequelize);
const Program = ProgramFactory(sequelize);
const Registration = RegistrationFactory(sequelize);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.SERVER2_PORT || 3002;

// ===================== MULTER CONFIG =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads/siwes'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ===================== MIDDLEWARE =====================
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===================== ROUTES =====================
app.get('/health', (_, res) => res.json({ service: 'registration-service', status: 'OK' }));

app.post('/api/registrations', authenticate, requireAffiliate, upload.single('siwesForm'), async (req, res) => {
  try {
    const registrationData = {
      ...req.body,
      affiliateId: req.user.id,
      status: 'pending_approval',
      siwesFormPath: req.file ? `siwes/${req.file.filename}` : null,
      siwesFormName: req.file ? req.file.originalname : null,
      commissionEarned: req.body.amount * 0.1
    };

    const registration = await Registration.create(registrationData);
    res.status(201).json({ success: true, data: registration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('[PostgreSQL] Connected to innospace_registrations');

    // Setup associations using the initialized models
    setupAssociations(sequelize);

    // This will now successfully create the 'users' table because it's been initialized
    await sequelize.sync({ alter: true });
    console.log('✅ Registration Database synced and tables created.');

    app.listen(PORT, () => {
      console.log(`📋 Registration Service running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start Registration Service:', err);
    process.exit(1);
  }
};

start();