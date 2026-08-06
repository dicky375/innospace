// src/middleware/upload.js
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

// Create local uploads directory as fallback
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Check if Cloudinary is properly configured
const hasCloudinaryCredentials = !!(process.env.CLOUDINARY_CLOUD_NAME && 
                                process.env.CLOUDINARY_API_KEY && 
                                process.env.CLOUDINARY_API_SECRET);

if (!hasCloudinaryCredentials) {
  console.warn('[Upload] ⚠️ Missing Cloudinary credentials! Using local storage fallback.');
}

// ✅ Use memory storage (no disk write, direct to Cloudinary)
const storage = multer.memoryStorage();

// ✅ File filter
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

// ✅ Create multer upload instance
const multerUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// ✅ Direct upload to Cloudinary with detailed error logging
const uploadToCloudinary = (buffer, originalname, userId) => {
  return new Promise((resolve, reject) => {
    const ext = originalname.match(/\.[^.]+$/)?.[0] || '';
    const baseName = originalname.replace(/\.[^.]+$/, '');
    const publicId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}-${baseName}`;
    
    console.log(`[Upload] Uploading to Cloudinary: ${publicId}`);
    console.log(`[Upload] File size: ${buffer.length} bytes`);
    console.log(`[Upload] Using upload preset: ${process.env.CLOUDINARY_UPLOAD_PRESET || 'innospace-unsigned'}`);
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'innospace/siwes-forms',
        public_id: publicId,
        resource_type: 'auto',
        upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || 'innospace-unsigned',
        allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
      },
      (error, result) => {
        if (error) {
          console.error('[Upload] ❌ Cloudinary upload error:');
          console.error('  Message:', error.message);
          console.error('  HTTP Code:', error.http_code);
          console.error('  Error details:', JSON.stringify(error, null, 2));
          reject(error);
        } else {
          console.log('[Upload] ✅ Cloudinary upload successful:', result.secure_url);
          resolve(result);
        }
      }
    );
    
    // Convert buffer to stream and pipe to Cloudinary
    const bufferStream = Readable.from(buffer);
    bufferStream.pipe(uploadStream);
    
    // ✅ Add error handler for the stream
    bufferStream.on('error', (err) => {
      console.error('[Upload] ❌ Stream error:', err);
      reject(err);
    });
  });
};

// ✅ Main upload middleware
const upload = (fieldName = 'siwesForm') => {
  return async (req, res, next) => {
    const multerMiddleware = multerUpload.single(fieldName);
    
    multerMiddleware(req, res, async (err) => {
      if (err) {
        console.error('[Upload] ❌ Multer error:', err.message);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      
      if (!req.file) {
        console.log('[Upload] No file uploaded');
        return next();
      }
      
      try {
        console.log('[Upload] Processing file:', req.file.originalname);
        console.log('[Upload] File size:', req.file.size, 'bytes');
        console.log('[Upload] MIME type:', req.file.mimetype);
        
        // ✅ Upload to Cloudinary
        const result = await uploadToCloudinary(
          req.file.buffer,
          req.file.originalname,
          req.user?.id || 'anonymous'
        );
        
        // ✅ Attach Cloudinary info to req.file
        req.file.path = result.secure_url;
        req.file.filename = result.public_id;
        req.file.secure_url = result.secure_url;
        req.file.public_id = result.public_id;
        req.file.cloudinary_result = result;
        
        // ✅ Remove buffer to free memory
        delete req.file.buffer;
        
        console.log('[Upload] ✅ Upload complete:', req.file.path);
        next();
        
      } catch (error) {
        console.error('[Upload] ❌ Cloudinary error:', error);
        console.error('[Upload] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        // ✅ Send detailed error response
        return res.status(500).json({
          success: false,
          error: 'Failed to upload file to cloud storage',
          details: error.message,
          http_code: error.http_code || null
        });
      }
    });
  };
};

// ✅ Error handler middleware
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('[Upload] Multer error:', err.message);
    return res.status(400).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }
  
  if (err) {
    console.error('[Upload] Upload error:', err.message);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  
  next();
};

// Log configuration
console.log('='.repeat(60));
console.log('[Upload] Upload middleware configured:');
console.log(`  Storage: ☁️ Cloudinary (direct upload)`);
console.log(`  Max file size: 10MB`);
console.log(`  Allowed formats: PDF, DOC, DOCX, JPG, PNG`);
console.log(`  Upload Preset: ${process.env.CLOUDINARY_UPLOAD_PRESET || 'innospace-unsigned'}`);
console.log('='.repeat(60));

export default upload;