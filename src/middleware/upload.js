// src/middleware/upload.js
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ✅ FORCE Cloudinary configuration
cloudinary.config({
  cloud_name: 'dd4bxsolt',
  api_key: '631292745235875',
  api_secret: 'ZkQQXurB1IHBQEC-Bm0wHXyF7Xg',
  secure: true
});

console.log('[Upload] 🔧 Cloudinary configured:');
console.log('  Cloud Name:', cloudinary.config().cloud_name);
console.log('  API Key:', cloudinary.config().api_key ? '✅ Set' : '❌ Missing');

// Create uploads directory
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  console.log(`[Upload] File: ${file.originalname} (${ext})`);
  
  if (allowed.includes(ext)) {
    console.log('[Upload] ✅ File type accepted');
    cb(null, true);
  } else {
    console.log('[Upload] ❌ File type rejected:', ext);
    cb(new Error(`File type not allowed. Only ${allowed.join(', ')} are accepted.`), false);
  }
};

const multerUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ✅ Generate signature for signed upload
const generateSignature = (publicId, timestamp) => {
  const params = {
    public_id: publicId,
    timestamp: timestamp,
    folder: 'innospace/siwes-forms'
  };
  
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const signature = crypto
    .createHash('sha256')
    .update(sortedParams + cloudinary.config().api_secret)
    .digest('hex');
  
  return signature;
};

// ✅ Direct upload to Cloudinary with signature
const uploadToCloudinary = (buffer, originalname, userId) => {
  return new Promise((resolve, reject) => {
    const baseName = originalname.replace(/\.[^.]+$/, '');
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `${userId}-${timestamp}-${Math.random().toString(36).substr(2, 6)}-${baseName}`;
    const signature = generateSignature(publicId, timestamp);
    
    console.log(`[Upload] 📤 Signed upload to Cloudinary:`, {
      publicId,
      size: buffer.length,
      timestamp,
      signatureLength: signature.length
    });
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'innospace/siwes-forms',
        public_id: publicId,
        resource_type: 'auto',
        timestamp: timestamp,
        signature: signature,
        api_key: cloudinary.config().api_key,
        allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
      },
      (error, result) => {
        if (error) {
          console.error('[Upload] ❌ Cloudinary error:', error.message);
          console.error('[Upload] HTTP Code:', error.http_code);
          reject(error);
        } else {
          console.log('[Upload] ✅ Upload successful:', result.secure_url);
          resolve(result);
        }
      }
    );
    
    const bufferStream = Readable.from(buffer);
    bufferStream.pipe(uploadStream);
    bufferStream.on('error', reject);
  });
};

// ✅ Main upload middleware
const upload = (fieldName = 'siwesForm') => {
  return async (req, res, next) => {
    const multerMiddleware = multerUpload.single(fieldName);
    
    multerMiddleware(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      
      if (!req.file) {
        return next();
      }
      
      try {
        const result = await uploadToCloudinary(
          req.file.buffer,
          req.file.originalname,
          req.user?.id || 'anonymous'
        );
        
        req.file.path = result.secure_url;
        req.file.filename = result.public_id;
        req.file.secure_url = result.secure_url;
        req.file.public_id = result.public_id;
        delete req.file.buffer;
        
        console.log('[Upload] ✅ Complete:', req.file.path);
        next();
      } catch (error) {
        console.error('[Upload] ❌ Error:', error.message);
        res.status(500).json({
          success: false,
          error: 'Failed to upload file to cloud storage',
          details: error.message,
          http_code: error.http_code || null
        });
      }
    });
  };
};

console.log('='.repeat(60));
console.log('[Upload] Upload middleware configured:');
console.log(`  Storage: ☁️ Cloudinary (signed upload)`);
console.log(`  Max file size: 10MB`);
console.log(`  Allowed formats: PDF, DOC, DOCX, JPG, PNG`);
console.log('='.repeat(60));

export default upload;