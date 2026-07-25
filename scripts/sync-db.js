import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function syncDatabase() {
  try {
    console.log('\n🔧 Syncing database...');
    console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);

    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync all models
    await sequelize.sync({ alter: true, force: false });
    console.log('✅ Database synced successfully!');
    console.log('   Tables created/updated: Users, RefreshTokens, Programs, Registrations, Transactions, Payouts');

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to sync database:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

syncDatabase();