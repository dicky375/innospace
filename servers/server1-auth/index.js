import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 1. FIXED: Import the function, not the object
import { createConnection } from '../../shared/config/db.js';
import defineUser from '../../shared/models/User.js'; 
import defineRefreshToken from '../../shared/models/RefreshToken.js'; 
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();
app.use(helmet());
const PORT = process.env.SERVER1_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// 2. Initialize the connection specifically for the Auth Database
const sequelize = createConnection({
  name: process.env.DB_AUTH_NAME,
  user: process.env.DB_AUTH_USER,
  pass: process.env.DB_AUTH_PASS,
  host: process.env.DB_AUTH_HOST,
  port: process.env.DB_AUTH_PORT,
}, 'Server1 (auth)');

// 3. Initialize the shared models
const User = defineUser(sequelize);
const RefreshToken = defineRefreshToken(sequelize);

// ... Define Relationships (HasMany/BelongsTo) ...
User.hasMany(RefreshToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

// ... Password Hashing Hooks (beforeCreate/beforeUpdate) ...

app.use('/api/auth', authRoutes(User, RefreshToken));
app.use('/api/users', userRoutes(User));
// tis is done to check if the server is running via terminal
app.get("/", (req, res) => {
  res.json({
    service: "Auth Service",
    status: "running",
    port: 3001
  });
});
const startServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    
    app.listen(PORT, () => {
      console.log(`\n🔐 AUTH SERVICE ACTIVE`);
      console.log(`-----------------------------------`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`DB:  ${process.env.DB_AUTH_NAME}`);
      console.log(`-----------------------------------\n`);
    });
  } catch (err) {
    console.error('Core startup failed:', err.message);
    process.exit(1);
  }
};

startServer();