import { Sequelize } from 'sequelize';

/**
 * Creates a unique Sequelize connection for a microservice.
 * Supports both:
 * - Full connection URL (for Neon/production): process.env.DATABASE_URL
 * - Individual credentials (for local development): host, user, pass, name, port
 */
export function createConnection(config, label) {
  const isProduction = process.env.NODE_ENV === 'production';

  const sslOptions = isProduction ? {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  } : {};

  let sequelize;

  // Use full connection URL if provided (Neon/production)
  if (config.url) {
    sequelize = new Sequelize(config.url, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: sslOptions,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: true,
        underscored: true,
      },
    });
  } else {
    // Use individual credentials (local development)
    if (!config.name || !config.user) {
      console.error(`[PostgreSQL] ✗ ${label} failed: Missing DB credentials in .env`);
      return null;
    }

    sequelize = new Sequelize(config.name, config.user, config.pass, {
      host: config.host || 'localhost',
      port: config.port || 5432,
      dialect: 'postgres',
      logging: false,
      dialectOptions: sslOptions,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: true,
        underscored: true,
      },
    });
  }

  // Verification
  sequelize
    .authenticate()
    .then(() => console.log(`[PostgreSQL] ✓ ${label} connected → ${config.name || config.url?.split('/').pop()}`))
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