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
    monthlyFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'monthly_fee'
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
    affiliateCommission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 35000.00,
      field: 'affiliate_commission',
      comment: 'Commission paid to affiliate per successful registration'
    }
  }, {
    tableName: 'programs',
    underscored: true,
    timestamps: true,
    paranoid: true,        // Soft deletes
  });

  return Program;
};