import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Registration = sequelize.define('Registration', {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    programId:        { type: DataTypes.UUID, allowNull: false, field: 'program_id' },
    affiliateId:      { type: DataTypes.UUID, allowNull: true, field: 'affiliate_id' },
    isSelfRegistered: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_self_registered' },

    // Student details
    studentName:      { type: DataTypes.STRING, allowNull: false, field: 'student_name' },
    studentPhone:     { type: DataTypes.STRING, allowNull: false, field: 'student_phone' },
    studentEmail:     { type: DataTypes.STRING, allowNull: true, field: 'student_email' },
    course:           { type: DataTypes.STRING, allowNull: false },
    department:       { type: DataTypes.STRING, allowNull: false },
    regNumber:        { type: DataTypes.STRING, allowNull: false, field: 'reg_number' },
    hodName:          { type: DataTypes.STRING, allowNull: false, field: 'hod_name' },
    supervisorName:   { type: DataTypes.STRING, allowNull: false, field: 'supervisor_name' },

    // File upload
    siwesFormPath:    { type: DataTypes.STRING, allowNull: true, field: 'siwes_form_path' },
    siwesFormName:    { type: DataTypes.STRING, allowNull: true, field: 'siwes_form_name' },

    // Status
    status: {
      type: DataTypes.ENUM('pending_approval', 'approved', 'rejected', 'paid', 'cancelled'),
      defaultValue: 'pending_approval',
    },
    approvedBy:       { type: DataTypes.UUID, allowNull: true, field: 'approved_by' },
    approvedAt:       { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
    rejectionReason:  { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
    paystackRef:      { type: DataTypes.STRING, field: 'paystack_ref' },
    commissionEarned: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'commission_earned' },
    amount:           { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  }, { tableName: 'registrations', underscored: true });

  return Registration;
};