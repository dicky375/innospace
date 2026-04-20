import { DataTypes } from 'sequelize';

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

    // Role: Only Admin and Affiliate (as per current requirement)
    role: {
      type: DataTypes.ENUM('admin', 'affiliate'),
      allowNull: false,
      defaultValue: 'affiliate'
    },

    // For Affiliates
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
      comment: 'Who referred this affiliate (if any)'
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },

    // Optional: Bank details for payout
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
    paranoid: true,           // Soft delete
  });

  return User;
};