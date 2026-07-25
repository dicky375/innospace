import { Sequelize } from 'sequelize';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import all models
import defineUser from '../models/User.js';
import defineRefreshToken from '../models/RefreshToken.js';
import defineProgram from '../models/Program.js';
import defineRegistration from '../models/Registration.js';
import defineTransaction from '../models/Transaction.js';
import definePayout from '../models/Payout.js';

// Single database connection
export const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: process.env.NODE_ENV === 'production' ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {},
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000
  }
});

// Initialize all models
export const User = defineUser(sequelize);
export const RefreshToken = defineRefreshToken(sequelize);
export const Program = defineProgram(sequelize);
export const Registration = defineRegistration(sequelize);
export const Transaction = defineTransaction(sequelize);
export const Payout = definePayout(sequelize);

// ===================== ASSOCIATIONS =====================
// User ↔ RefreshToken
User.hasMany(RefreshToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

// User ↔ Registration (Affiliate)
User.hasMany(Registration, { foreignKey: 'affiliate_id', as: 'affiliateRegistrations' });
Registration.belongsTo(User, { foreignKey: 'affiliate_id', as: 'affiliate' });

// Program ↔ Registration
Program.hasMany(Registration, { foreignKey: 'program_id' });
Registration.belongsTo(Program, { foreignKey: 'program_id' });

// User ↔ Registration (Approver)
User.hasMany(Registration, { foreignKey: 'approved_by', as: 'approvedRegistrations' });
Registration.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// User ↔ Transaction (Affiliate)
User.hasMany(Transaction, { foreignKey: 'affiliate_id' });
Transaction.belongsTo(User, { foreignKey: 'affiliate_id' });

// User ↔ Payout (Affiliate)
User.hasMany(Payout, { foreignKey: 'affiliate_id' });
Payout.belongsTo(User, { foreignKey: 'affiliate_id' });

// Registration ↔ Transaction
Registration.hasOne(Transaction, { foreignKey: 'registration_id' });
Transaction.belongsTo(Registration, { foreignKey: 'registration_id' });

export async function initModels() {
  // All models already initialized above
  console.log('✅ Models initialized');
  return { User, RefreshToken, Program, Registration, Transaction, Payout };
}

export default { sequelize, User, RefreshToken, Program, Registration, Transaction, Payout };