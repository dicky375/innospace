import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Registration = sequelize.define('Registration', {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    programId:        { type: DataTypes.UUID, allowNull: false, field: 'program_id' },
    registeredUserId: { type: DataTypes.UUID, allowNull: false, field: 'registered_user_id' },
    internId:         { type: DataTypes.UUID, allowNull: true, field: 'intern_id' },  // null if self-registered
    isSelfRegistered: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_self_registered' },
    status: {
      type: DataTypes.ENUM('pending_approval', 'approved', 'rejected', 'paid', 'cancelled'),
      defaultValue: 'pending_approval',
    },
    approvedBy:      { type: DataTypes.UUID, allowNull: true, field: 'approved_by' },  // admin user id
    approvedAt:      { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
    paystackRef:     { type: DataTypes.STRING, field: 'paystack_ref' },
    commissionEarned:{ type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'commission_earned' },
    amount:          { type: DataTypes.DECIMAL(10, 2), allowNull: false },  // first month fee
  }, { tableName: 'registrations', underscored: true });

  return Registration;
};