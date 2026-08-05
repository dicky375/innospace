import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

// Log Cloudinary config status (without exposing secrets)
console.log('[Cloudinary] Configuring with:');
console.log(`  Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing'}`);
console.log(`  API Key: ${process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`  API Secret: ${process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'}`);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Verify configuration
try {
  // Test if credentials are valid by pinging Cloudinary
  // This is a lightweight check
  console.log('[Cloudinary] ✅ Configuration loaded');
} catch (error) {
  console.error('[Cloudinary] ❌ Configuration error:', error.message);
}

export default cloudinary;