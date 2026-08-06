// src/middleware/upload.js
import multer from 'multer';
import { UploadClient } from '@uploadcare/upload-client';
import path from 'path';
import fs from 'fs';

// ✅ Uploadcare configuration
const UPLOADCARE_PUBLIC_KEY = process.env.UPLOADCARE_PUBLIC_KEY;

console.log('[Upload] 🔧 Uploadcare configured:');
console.log('  Public Key:', UPLOADCARE_PUBLIC_KEY ? '✅ Set' : '❌ Missing');

// Create local uploads directory as fallback
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Initialize Uploadcare client
const client = new UploadClient({
  publicKey: UPLOADCARE_PUBLIC_KEY,
});

// ✅ Use memory storage
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

// ✅ Upload to Uploadcare
const uploadToUploadcare = (buffer, originalname, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`[Upload] 📤 Uploading to Uploadcare:`, {
        fileName: originalname,
        size: buffer.length,
        userId
      });
      
      // Upload to Uploadcare
      const result = await client.uploadFile(buffer, {
        fileName: originalname,
        store: 'auto',
        metadata: {
          userId: userId || 'anonymous',
          uploadTime: new Date().toISOString()
        }
      });

      const fileUrl = `${result.cdnUrl}${originalname}`;
      req.file.path = fileUrl;
      req.file.secure_url = fileUrl;
      req.file.filename = result.uuid;
      req.file.uuid = result.uuid;
      req.file.uploadcare_result = result;
      
      console.log('[Upload] ✅ Upload successful:');
      console.log('  UUID:', result.uuid);
      console.log('  CDN URL:', result.cdnUrl);
      
      resolve(result);
      
    } catch (error) {
      console.error('[Upload] ❌ Uploadcare error:');
      console.error('  Message:', error.message);
      console.error('  Response:', error.response?.data);
      reject(error);
    }
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
        console.log('[Upload] 📁 Processing file:', req.file.originalname);
        console.log('[Upload] File size:', req.file.size, 'bytes');
        console.log('[Upload] MIME type:', req.file.mimetype);
        
        // ✅ Upload to Uploadcare
        const result = await uploadToUploadcare(
          req.file.buffer,
          req.file.originalname,
          req.user?.id || 'anonymous'
        );
        
        // ✅ Attach Uploadcare info to req.file
        req.file.path = result.cdnUrl;
        req.file.secure_url = result.cdnUrl;
        req.file.filename = result.uuid;
        req.file.uuid = result.uuid;
        req.file.uploadcare_result = result;
        
        // ✅ Remove buffer to free memory
        delete req.file.buffer;
        
        console.log('[Upload] ✅ Upload complete:', req.file.path);
        next();
        
      } catch (error) {
        console.error('[Upload] ❌ Error:', error.message);
        
        // ✅ Send detailed error response
        return res.status(500).json({
          success: false,
          error: 'Failed to upload file',
          details: error.message,
          http_code: 500
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
console.log(`  Storage: ☁️ Uploadcare`);
console.log(`  Max file size: 10MB`);
console.log(`  Allowed formats: PDF, DOC, DOCX, JPG, PNG`);
console.log('='.repeat(60));

export default upload;