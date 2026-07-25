import pkg from 'sequelize';
const { DataTypes } = pkg;

export default (sequelize) => {
  const Payout = sequelize.define('Payout', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    affiliateId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'affiliate_id'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    bankName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'bank_name'
    },
    accountNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'account_number'
    },
    accountName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'account_name'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    processedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'processed_by'
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at'
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason'
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'payouts',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['affiliate_id'] },
      { fields: ['status'] },
      { fields: ['affiliate_id', 'status'] },
      { fields: ['created_at'] },
      { fields: ['status', 'created_at'] }
    ]
  });

  return Payout;
};