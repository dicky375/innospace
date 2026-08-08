import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Program = sequelize.define('Program', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [5, 200]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Total program price in Naira'
    },
    durationMonths: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'duration_months',
      validate: {
        min: 1,
        max: 12
      }
    },
    commissionRate: {
  type: DataTypes.DECIMAL(5, 2),
  defaultValue: 10.00,
  allowNull: false,
  field: 'commission_rate',
  comment: 'Commission percentage for this program (e.g., 10.00 = 10%)'
},
    type: {
      type: DataTypes.ENUM('internship', 'siwes'),
      allowNull: false,
      defaultValue: 'internship'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      comment: 'Admin user ID who created this program'
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'NGN',
      allowNull: false
    }
  }, {
    tableName: 'programs',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['title'] },
      { fields: ['is_active'] },
      { fields: ['type'] },
      { fields: ['created_by'] },
      { fields: ['is_active', 'type'] }
    ]
  });

  return Program;
};