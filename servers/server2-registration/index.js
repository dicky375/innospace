import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createConnection } from '../../shared/config/db.js';
import defineProgram from './models/program.js';
import defineRegistration from './models/registration.js';
import programRoutes from './routes/program.routes.js';
import registrationRoutes from './routes/registration.routes.js';

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

const Program = defineProgram(sequelize);
const Registration = defineRegistration(sequelize);

Program.hasMany(Registration, { foreignKey: 'program_id' });
Registration.belongsTo(Program, { foreignKey: 'program_id' });

app.use('/api/programs', programRoutes(Program));
app.use('/api/registrations', registrationRoutes(Registration, Program));

app.get('/health', (_, res) => res.json({ service: 'registration-service', status: 'UP' }));

const startServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
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