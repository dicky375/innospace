import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 1. Setup Environment (Must happen before ANY other internal imports)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';

// Internal Imports
import { createConnection } from '../../shared/config/db.js';
import defineUser from './models/user.js';
import defineRefreshToken from './models/refreshToken.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();
const PORT = process.env.SERVER1_PORT || 3001;

// 2. Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// 3. Database & Models Initialization
const sequelize = createConnection({
  name: process.env.DB_AUTH_NAME,
  user: process.env.DB_AUTH_USER,
  pass: process.env.DB_AUTH_PASS,
  host: process.env.DB_AUTH_HOST,
  port: process.env.DB_AUTH_PORT,
}, 'Server1 (auth)');

const User = defineUser(sequelize);
const RefreshToken = defineRefreshToken(sequelize);

// 4. Define Relationships
User.hasMany(RefreshToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

// 5. Password Hashing Hooks
const hashPassword = async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 12);
  }
};

User.beforeCreate(hashPassword);
User.beforeUpdate(hashPassword);

// 6. Routes
app.use('/api/auth', authRoutes(User, RefreshToken));
app.use('/api/users', userRoutes(User));

// Health Check
app.get('/health', (_, res) => res.json({ 
  service: 'auth-service', 
  status: 'UP', 
  db: sequelize.options.database 
}));

// 7. Server Start Logic
const startServer = async () => {
  try {
    await sequelize.authenticate();
    // Use { alter: true } only in development
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    
    app.listen(PORT, () => {
      console.log(`\n🔐 AUTH SERVICE ACTIVE`);
      console.log(`-----------------------------------`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`DB:  ${process.env.DB_AUTH_NAME}`);
      console.log(`JWT: ${process.env.JWT_ACCESS_SECRET ? 'Configured ✅' : 'MISSING ❌'}`);
      console.log(`-----------------------------------\n`);
    });
  } catch (err) {
    console.error('Core startup failed:', err.message);
    process.exit(1);
  }
};

startServer();