import { Sequelize } from 'sequelize';

/**
 * Creates a unique Sequelize connection for a microservice.
 * @param {Object} config - DB credentials (name, user, pass, host, port)
 * @param {string} label - The name of the service for logging
 */
export function createConnection(config, label) {
  // Defensive check: Ensure we don't try to connect with undefined values
  if (!config.name || !config.user) {
    console.error(`[PostgreSQL] ✗ ${label} failed: Missing DB credentials in .env`);
    return null;
  }

  const sequelize = new Sequelize(config.name, config.user, config.pass, {
    host: config.host || 'localhost',
    port: config.port || 5432,
    dialect: 'postgres',
    logging: false, // Set to console.log during debugging if needed
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    // Addition: Ensure timestamps are handled consistently across services
    define: {
      timestamps: true,
      underscored: true,
    }
  });

  // Verification
  sequelize
    .authenticate()
    .then(() => console.log(`[PostgreSQL] ✓ ${label} connected → ${config.name}`))
    .catch((err) => console.error(`[PostgreSQL] ✗ ${label} error:`, err.message));

  // Graceful Shutdown
  process.on('SIGINT', async () => {
    try {
      await sequelize.close();
      console.log(`[PostgreSQL] ${label} connection closed`);
    } catch (err) {
      // Avoid hanging on shutdown
    }
  });

  return sequelize;
}