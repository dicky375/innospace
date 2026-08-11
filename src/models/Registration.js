import pkg from 'sequelize';
const { DataTypes } = pkg;

export default (sequelize) => {
  const Registration = sequelize.define('Registration', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    programId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'program_id',
      references: {
        model: 'programs',
        key: 'id'
      }
    },
    affiliateId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'affiliate_id',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'The affiliate who referred this student'
    },
    isSelfRegistered: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_self_registered'
    },
    studentName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'student_name'
    },
    studentPhone: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'student_phone'
    },
    studentEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'student_email',
      validate: { isEmail: true }
    },
    schoolName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'school_name',
      comment: 'Name of the student\'s school/institution'
    },
    course: {
      type: DataTypes.STRING,
      allowNull: false
    },
    department: {
      type: DataTypes.STRING,
      allowNull: false
    },
    regNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'reg_number',
      unique: true
    },
    hodName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'hod_name'
    },
    supervisorName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'supervisor_name'
    },
    // ✅ ADD commissionRate FIELD
    commissionRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'commission_rate',
      defaultValue: 10.00,
      comment: 'Commission rate at registration time (stored for audit)'
    },
    siwesFormPath: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'siwes_form_path'
    },
    siwesFormName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'siwes_form_name'
    },
    siwesFormMimetype: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'siwes_form_mimetype'
    },
    siwesFormSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'siwes_form_size',
      comment: 'File size in bytes'
    },
    status: {
      type: DataTypes.ENUM('pending_approval', 'approved', 'rejected', 'paid', 'cancelled'),
      defaultValue: 'pending_approval'
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'approved_by'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'approved_at'
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason'
    },
    commissionEarned: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'commission_earned'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    paystackRef: {
      type: DataTypes.STRING,
      field: 'paystack_ref',
      allowNull: true
    },
    paystackData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'paystack_data',
      comment: 'Full Paystack webhook data'
    }
  }, {
    tableName: 'registrations',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['program_id'] },
      { fields: ['affiliate_id'] },
      { fields: ['reg_number'], unique: true },
      { fields: ['student_email'] },
      { fields: ['created_at'] },
      { fields: ['status', 'affiliate_id'] },
      { fields: ['program_id', 'status'] }
    ]
  });

  // ✅ ADD ASSOCIATIONS HERE
  Registration.associate = (models) => {
    Registration.belongsTo(models.Program, {
      foreignKey: 'programId',
      as: 'program'
    });
    
    Registration.belongsTo(models.User, {
      foreignKey: 'affiliateId',
      as: 'affiliate'
    });
  };

  return Registration;
};