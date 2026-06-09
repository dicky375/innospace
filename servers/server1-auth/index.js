import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createConnection } from '../../shared/config/db.js';
import defineUser from '../../shared/models/User.js';
import defineRefreshToken from '../../shared/models/RefreshToken.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';

export const app = express();
app.use(helmet());

const PORT = process.env.SERVER1_PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// Initialize DB — uses URL in production, individual credentials locally
export const sequelize = createConnection({
  url: process.env.DATABASE_AUTH_URL,
  name: process.env.DB_AUTH_NAME,
  user: process.env.DB_AUTH_USER,
  pass: process.env.DB_AUTH_PASS,
  host: process.env.DB_AUTH_HOST,
  port: process.env.DB_AUTH_PORT,
}, 'Server1 (auth)');

export const User = defineUser(sequelize);
export const RefreshToken = defineRefreshToken(sequelize);

User.hasMany(RefreshToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

app.use('/api/auth', authRoutes(User, RefreshToken));
app.use('/api/users', userRoutes(User));

app.get('/', (req, res) => {
  res.json({ service: 'Auth Service', status: 'running', port: PORT });
});

app.get('/health', (_, res) => {
  res.json({ service: 'auth-service', status: 'UP' });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });

    app.listen(PORT, () => {
      console.log(`\n🔐 AUTH SERVICE ACTIVE`);
      console.log(`-----------------------------------`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`DB:  ${process.env.DB_AUTH_NAME || 'Neon (production)'}`);
      console.log(`-----------------------------------\n`);
    });
  } catch (err) {
    console.error('Core startup failed:', err.message);
    process.exit(1);
  }
};

startServer();