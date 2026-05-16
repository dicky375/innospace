import './env.js';
import { __dirname } from './env.js';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createConnection } from '../../shared/config/db.js';
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

const startServer = async () => {
  try {
    // ✅ createConnection runs HERE, after env.js has loaded
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

    app.use('/api/programs', programRoutes(Program));
    app.use('/api/registrations', registrationRoutes(Registration, Program));

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