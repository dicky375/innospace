import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { sequelize, User } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function seedAdmin() {
  try {
    console.log('\n🔧 Seeding admin user...');
    console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);

    await sequelize.authenticate();
    console.log('✅ Database connected');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@innospace.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const adminName = process.env.ADMIN_NAME || 'Super Admin';
    const adminPhone = process.env.ADMIN_PHONE || '08012345678';

    const existingAdmin = await User.findOne({
      where: { email: adminEmail }
    });

    if (existingAdmin) {
      console.log(`⚠️ Admin already exists with email: ${adminEmail}`);
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      phone: adminPhone,
      role: 'admin',
      isActive: true,
      emailVerified: true,
      referralCode: `ADMIN-${Date.now().toString(36)}`
    });

    console.log('\n✅ Admin created successfully!');
    console.log('=========================================');
    console.log(`📧 Email:    ${admin.email}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log(`👤 Name:     ${admin.name}`);
    console.log('=========================================');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    console.log('=========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

seedAdmin();