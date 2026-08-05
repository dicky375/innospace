// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ✅ Log Cloudinary configuration
console.log('[Cloudinary] Configuring with:');
console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
console.log('  API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// ✅ Test the configuration with a ping
const testCloudinaryConnection = async () => {
  try {
    // Try to ping Cloudinary
    const result = await cloudinary.api.ping();
    console.log('[Cloudinary] ✅ Connection test successful:', result);
    return true;
  } catch (err) {
    console.error('[Cloudinary] ❌ Connection test failed:', err.message);
    console.error('[Cloudinary] ❌ Error details:', err);
    return false;
  }
};

// Run the test
testCloudinaryConnection();

export default cloudinary;