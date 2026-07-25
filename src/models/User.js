import pkg from 'sequelize';
//import { DataTypes } from 'sequelize';
const {DataTypes} = pkg;

export default (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 100]
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('admin', 'affiliate'),
      allowNull: false,
      defaultValue: 'affiliate'
    },
    referralCode: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
      field: 'referral_code'
    },
    referredBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'referred_by',
      comment: 'Who referred this affiliate'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'email_verified'
    },
    verificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'verification_token'
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'reset_password_token'
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_password_expires'
    },
    bankName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'bank_name'
    },
    accountNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'account_number'
    },
    accountName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'account_name'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login'
    }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['role'] },
      { fields: ['referral_code'], unique: true },
      { fields: ['is_active'] },
      { fields: ['email_verified'] },
      { fields: ['verification_token'] },
      { fields: ['reset_password_token'] }
    ]
  });

  return User;
};