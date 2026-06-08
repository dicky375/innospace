import { DataTypes } from 'sequelize';

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

    // Student Information
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

    course: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.STRING, allowNull: false },
    regNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'reg_number',
      unique: true // Important: Matric number should be unique
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

    // Document Upload
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
    siwesFormData: {
  type: DataTypes.BLOB('long'),
  allowNull: true,
  field: 'siwes_form_data'
},
siwesFormMimetype: {
  type: DataTypes.STRING,
  allowNull: true,
  field: 'siwes_form_mimetype'
},

    // Status & Workflow
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

    // Commission & Payment
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
    }
  }, {
    tableName: 'registrations',
    underscored: true,
    timestamps: true,
    paranoid: true,           // Soft delete support
  });

  return Registration;
};