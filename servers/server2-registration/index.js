import './env.js';
import {__dirname } from './env.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import helmet from 'helmet';
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true});


import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

// 1. FIXED: Use the correct function export from your db.js
import { createConnection } from '../../shared/config/db.js';

// 2. IMPORT THE MODELS (Ensuring exact casing for Lubuntu)
import defineUser from '../../shared/models/User.js'; 
import defineProgram from './models/program.js';
import defineRegistration from './models/registration.js';

import programRoutes from './routes/program.routes.js';
import registrationRoutes from './routes/registration.routes.js';

const app = express();
const PORT = process.env.SERVER2_PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadDir));

// 3. Initialize the connection for this specific service
const sequelize = createConnection({
  name: process.env.DB_REG_NAME,
  user: process.env.DB_REG_USER,
  pass: process.env.DB_REG_PASS,
  host: process.env.DB_REG_HOST,
  port: process.env.DB_REG_PORT,
}, 'Server2 (registration)');

// 4. INITIALIZE ALL MODELS
const User = defineUser(sequelize); 
const Program = defineProgram(sequelize);
const Registration = defineRegistration(sequelize);

// 5. DEFINE RELATIONSHIPS
Program.hasMany(Registration, { foreignKey: 'program_id' });
Registration.belongsTo(Program, { foreignKey: 'program_id' });
Registration.belongsTo(User, { foreignKey: 'affiliate_id', as: 'affiliate' });

app.use('/api/programs', programRoutes(Program));
app.use('/api/registrations', registrationRoutes(Registration, Program));

app.get('/health', (_, res) => res.json({ service: 'registration-service', status: 'UP' }));
// This endpoint is just to verify that the server is running when accessed via terminal
app.get("/", (req, res) => {
  res.json({
    service: "Registration Service",
    status: "running",
    port: 3002
  });
});
const startServer = async () => {
  try {
    await sequelize.authenticate();
    
    // 6. SYNC WITH ALTER
    // This will now successfully create the 'users' table in innospace_registrations
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' }); // Only alter in development
    
    app.listen(PORT, () => {
      console.log(`\n📋 REGISTRATION SERVICE ACTIVE`);
      console.log(`-----------------------------------`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`DB:  ${sequelize.options.database}`);
      console.log(`-----------------------------------\n`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};

startServer();