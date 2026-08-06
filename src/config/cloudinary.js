// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';

// ✅ HARDCODE FOR TESTING (remove after verifying env vars work)
cloudinary.config({
  cloud_name: 'dd4bxsolt',
  api_key: '631292745235875',
  api_secret: 'ZkQQXurB1IHBQEC-Bm0wHXyF7Xg',
  secure: true
});

console.log('[Cloudinary] ✅ Configured with hardcoded values:');
console.log('  Cloud Name: dd4bxsolt');
console.log('  API Key: 631292745235875');
console.log('  API Secret: [SET]');

export default cloudinary;