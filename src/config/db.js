import pkg from 'sequelize';
const { Sequelize } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Import all model definitions
import defineUser from '../models/User.js';
import defineRefreshToken from '../models/RefreshToken.js';
import defineProgram from '../models/Program.js';
import defineRegistration from '../models/Registration.js';
import defineTransaction from '../models/Transaction.js';
import definePayout from '../models/Payout.js';

// ===================== DATABASE CONNECTION =====================
const sequelize = new Sequelize(process.env.DATABASE_URL, {
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

// ===================== INITIALIZE MODELS =====================
const User = defineUser(sequelize);
const RefreshToken = defineRefreshToken(sequelize);
const Program = defineProgram(sequelize);
const Registration = defineRegistration(sequelize);
const Transaction = defineTransaction(sequelize);
const Payout = definePayout(sequelize);

// ===================== ASSOCIATIONS =====================
// User ↔ RefreshToken
User.hasMany(RefreshToken, { 
  foreignKey: 'user_id', 
  as: 'refreshTokens',
  onDelete: 'CASCADE' 
});
RefreshToken.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});

// User ↔ Registration (Affiliate)
User.hasMany(Registration, { 
  foreignKey: 'affiliate_id', 
  as: 'affiliateRegistrations' 
});
Registration.belongsTo(User, { 
  foreignKey: 'affiliate_id', 
  as: 'affiliate' 
});

// User ↔ Registration (Approver)
User.hasMany(Registration, { 
  foreignKey: 'approved_by', 
  as: 'approvedRegistrations' 
});
Registration.belongsTo(User, { 
  foreignKey: 'approved_by', 
  as: 'approver' 
});

// Program ↔ Registration
Program.hasMany(Registration, { 
  foreignKey: 'program_id', 
  as: 'program' 
});
Registration.belongsTo(Program, { 
  foreignKey: 'program_id', 
  as: 'program' 
});

// Registration ↔ Transaction
Registration.hasOne(Transaction, { 
  foreignKey: 'registration_id', 
  as: 'transaction' 
});
Transaction.belongsTo(Registration, { 
  foreignKey: 'registration_id', 
  as: 'registration' 
});

// User ↔ Transaction
User.hasMany(Transaction, { 
  foreignKey: 'affiliate_id', 
  as: 'transactions' 
});
Transaction.belongsTo(User, { 
  foreignKey: 'affiliate_id', 
  as: 'affiliate' 
});

// User ↔ Payout
User.hasMany(Payout, { 
  foreignKey: 'affiliate_id', 
  as: 'payouts' 
});
Payout.belongsTo(User, { 
  foreignKey: 'affiliate_id', 
  as: 'affiliate' 
});

// User ↔ Payout (Processor)
User.hasMany(Payout, { 
  foreignKey: 'processed_by', 
  as: 'processedPayouts' 
});
Payout.belongsTo(User, { 
  foreignKey: 'processed_by', 
  as: 'processor' 
});

// ===================== EXPORTS =====================
export {
  sequelize,
  User,
  RefreshToken,
  Program,
  Registration,
  Transaction,
  Payout
};

export default {
  sequelize,
  User,
  RefreshToken,
  Program,
  Registration,
  Transaction,
  Payout
};