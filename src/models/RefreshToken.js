import pkg from 'sequelize'
const { DataTypes } = pkg;

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
      onDelete: 'CASCADE'
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
    deviceInfo: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'device_info'
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'ip_address'
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'user_agent'
    }
  }, {
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['token'], unique: true },
      { fields: ['user_id'] },
      { fields: ['expires_at'] },
      { fields: ['is_revoked'] },
      { fields: ['user_id', 'is_revoked'] }
    ]
  });

  // Static methods
  RefreshToken.cleanupExpired = async function() {
    const { Op } = await import('sequelize');
    return this.destroy({
      where: {
        expiresAt: { [Op.lt]: new Date() },
        isRevoked: true
      }
    });
  };

  RefreshToken.getValidTokens = async function(userId) {
    const { Op } = await import('sequelize');
    return this.findAll({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { [Op.gt]: new Date() }
      }
    });
  };

  return RefreshToken;
};