import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Program = sequelize.define('Program', {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title:       { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    monthlyFee:  { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'monthly_fee' },
    durationMonths: { type: DataTypes.INTEGER, allowNull: false, field: 'duration_months' },
    type:        { type: DataTypes.ENUM('internship', 'siwes'), defaultValue: 'regular' },
    category:    { type: DataTypes.STRING },
    isActive:    { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  }, { tableName: 'programs', underscored: true });

  return Program;
};