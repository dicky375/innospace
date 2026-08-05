import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/test-cloudinary.js /path/to/file.pdf');
  process.exit(1);
}

console.log('Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('Uploading:', filePath);

try {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'innospace/siwes-forms',
    resource_type: 'auto',
  });
  console.log('✅ SUCCESS');
  console.log(result);
} catch (err) {
  console.log('❌ ERROR DETAILS');
  console.log('http_code:', err.http_code);
  console.log('message:', err.message);
  console.log('error field:', err.error);
  console.dir(err, { depth: null });
}
