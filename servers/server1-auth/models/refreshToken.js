import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    token:     { type: DataTypes.TEXT, allowNull: false, unique: true },
    userId:    { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    isRevoked: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_revoked' },
  }, { tableName: 'refresh_tokens', underscored: true });

  return RefreshToken;
};