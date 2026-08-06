// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load .env from root with explicit path
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ✅ Log configuration (without exposing secrets)
console.log('[Cloudinary] Configuring with:');
console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
console.log('  API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
console.log('  Upload Preset:', process.env.CLOUDINARY_UPLOAD_PRESET ? '✅ Set' : '❌ Missing');

// ✅ Configure Cloudinary with explicit values
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// ✅ Verify configuration
if (!process.env.CLOUDINARY_API_KEY) {
  console.error('[Cloudinary] ❌ API KEY IS MISSING!');
}

export default cloudinary;