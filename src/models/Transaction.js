import pkg from 'sequelize';
const { DataTypes } = pkg;

export default (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    registrationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'registration_id'
    },
    affiliateId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'affiliate_id'
    },
    paidUserEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'paid_user_email'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    commission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    paystackRef: {
      type: DataTypes.STRING,
      unique: true,
      field: 'paystack_ref'
    },
    paystackStatus: {
      type: DataTypes.ENUM('pending', 'success', 'failed'),
      defaultValue: 'pending',
      field: 'paystack_status'
    },
    commissionCredited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'commission_credited'
    }
  }, {
    tableName: 'transactions',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['paystack_ref'], unique: true },
      { fields: ['registration_id'] },
      { fields: ['affiliate_id'] },
      { fields: ['paystack_status'] },
      { fields: ['registration_id', 'paystack_status'] },
      { fields: ['affiliate_id', 'paystack_status'] },
      { fields: ['created_at'] }
    ]
  });

  return Transaction;
};