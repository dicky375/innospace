// scripts/test-cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testCloudinary() {
  console.log('🔍 Testing Cloudinary connection...');
  console.log('📋 Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('📋 API Key:', process.env.CLOUDINARY_API_KEY);
  console.log('📋 API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set (length: ' + process.env.CLOUDINARY_API_SECRET.length + ')' : '❌ Missing');

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Missing Cloudinary credentials!');
    return false;
  }

  // ✅ Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  try {
    // 1. Test API ping
    console.log('📡 Testing API ping...');
    const pingResult = await cloudinary.api.ping();
    console.log('✅ Ping successful:', pingResult);

    // 2. Test upload with a tiny 1x1 pixel PNG
    console.log('📤 Testing upload...');
    const testBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'innospace/test',
          public_id: `test-${Date.now()}`
        },
        (error, result) => {
          if (error) {
            console.error('❌ Upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      // Write buffer to stream
      uploadStream.write(testBuffer);
      uploadStream.end();
    });

    console.log('✅ Upload successful!');
    console.log('📎 URL:', uploadResult.secure_url);
    console.log('📎 Public ID:', uploadResult.public_id);

    return true;
  } catch (err) {
    console.error('❌ Cloudinary test failed:');
    console.error('Error:', err.message);
    if (err.http_code) {
      console.error('HTTP Code:', err.http_code);
    }
    if (err.error) {
      console.error('Error details:', err.error);
    }
    return false;
  }
}

// Run the test
console.log('='.repeat(60));
testCloudinary()
  .then(success => {
    console.log('='.repeat(60));
    if (success) {
      console.log('✅ Cloudinary is working correctly!');
      process.exit(0);
    } else {
      console.log('❌ Cloudinary test failed. Check your credentials.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Test error:', err);
    process.exit(1);
  });