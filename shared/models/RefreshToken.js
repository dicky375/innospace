import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'        // Important: Delete tokens if user is deleted
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    },

    isRevoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_revoked'
    },

    // Optional: Track device/session
    deviceInfo: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'device_info'
    },

    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'ip_address'
    }
  }, {
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: true,           // createdAt will help track when token was issued
    paranoid: false,            // Usually no need for soft delete on tokens
  });

  return RefreshToken;
};