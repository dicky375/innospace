// src/middleware/upload.js - Add at the top
// ✅ Force Cloudinary config here
import { v2 as cloudinary } from 'cloudinary';

// ✅ HARDCODE Cloudinary credentials (temporary fix)
cloudinary.config({
  cloud_name: 'dd4bxsolt',
  api_key: '631292745235875',
  api_secret: 'ZkQQXurB1IHBQEC-Bm0wHXyF7Xg',
  secure: true
});

console.log('[Upload] Cloudinary forced config:', {
  cloud_name: cloudinary.config().cloud_name,
  api_key: cloudinary.config().api_key ? '✅ Set' : '❌ Missing'
});