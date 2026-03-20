import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const User = sequelize.define('User', {
    id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:       { type: DataTypes.STRING, allowNull: false },
    email:      { type: DataTypes.STRING, allowNull: false, unique: true },
    password:   { type: DataTypes.STRING, allowNull: false },
    phone:      { type: DataTypes.STRING },
    role:       { type: DataTypes.ENUM('intern', 'user', 'admin'), defaultValue: 'user' },
    referredBy: { type: DataTypes.UUID, allowNull: true, field: 'referred_by' },
    isActive:   { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  }, { tableName: 'users', underscored: true });

  return User;
};