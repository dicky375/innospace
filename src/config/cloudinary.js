// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dd4bxsolt',
  api_key: process.env.CLOUDINARY_API_KEY || '631292745235875',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'ZkQQXurB1IHBQEC-Bm0wHXyF7Xg',
  secure: true
});

console.log('[Cloudinary] ✅ Configured');
console.log('  Cloud Name:', cloudinary.config().cloud_name);
console.log('  API Key:', cloudinary.config().api_key ? '✅ Set' : '❌ Missing');

export default cloudinary;