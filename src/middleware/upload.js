// src/middleware/upload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { UploadClient } from '@uploadcare/upload-client';

// ✅ Uploadcare configuration
const UPLOADCARE_PUBLIC_KEY = process.env.UPLOADCARE_PUBLIC_KEY;

console.log('[Upload] 🔧 Uploadcare configured:');
console.log('  Public Key:', UPLOADCARE_PUBLIC_KEY ? '✅ Set' : '❌ Missing');

// Create local uploads directory as fallback
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Initialize Uploadcare client with store: true
const client = new UploadClient({
  publicKey: UPLOADCARE_PUBLIC_KEY,
  store: true, // Store files permanently
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

// ✅ Upload to Uploadcare via REST API
const uploadToUploadcare = (buffer, originalname, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!UPLOADCARE_PUBLIC_KEY) {
        throw new Error('Uploadcare public key is missing');
      }

      console.log(`[Upload] 📤 Uploading to Uploadcare via REST API:`, {
        fileName: originalname,
        size: buffer.length,
        userId
      });

      const formData = new FormData();
      formData.append('file', buffer, {
        filename: originalname,
        contentType: originalname.endsWith('.pdf') ? 'application/pdf' : 
                     originalname.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                     originalname.endsWith('.doc') ? 'application/msword' :
                     'application/octet-stream'
      });
      formData.append('UPLOADCARE_PUB_KEY', UPLOADCARE_PUBLIC_KEY);
      formData.append('store', '1'); // ✅ Store permanently
      formData.append('filename', originalname);

      const response = await axios.post('https://upload.uploadcare.com/base/', formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 30000
      });

      console.log('[Upload] ✅ Upload successful:');
      console.log('  UUID:', response.data.file);
      console.log('  Response:', response.data);

      const fileUuid = response.data.file;
      const cdnUrl = `https://ucarecdn.com/${fileUuid}/`;
      const fullUrl = `${cdnUrl}${originalname}`;

      resolve({
        uuid: fileUuid,
        cdnUrl: cdnUrl,
        fullUrl: fullUrl,
        fileId: fileUuid,
        store: '1'
      });

    } catch (error) {
      console.error('[Upload] ❌ Uploadcare error:');
      console.error('  Message:', error.message);
      console.error('  Response:', error.response?.data);
      console.error('  Status:', error.response?.status);
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
        
        const userId = req.user?.id || 'anonymous';
        console.log('[Upload] User ID for upload:', userId);
        
        // ✅ FIX: Remove store:true from here - it's already in the client config
        const result = await uploadToUploadcare(
          req.file.buffer,
          req.file.originalname,
          userId
        );
        
        // ✅ Attach Uploadcare info to req.file
        req.file.path = result.fullUrl;
        req.file.secure_url = result.fullUrl;
        req.file.filename = result.uuid;
        req.file.uuid = result.uuid;
        req.file.uploadcare_result = result;
        
        // ✅ Remove buffer to free memory
        delete req.file.buffer;
        
        console.log('[Upload] ✅ Upload complete:', req.file.path);
        next();
        
      } catch (error) {
        console.error('[Upload] ❌ Error:', error.message);
        console.error('[Upload] Stack:', error.stack);
        
        return res.status(500).json({
          success: false,
          error: 'Failed to upload file',
          details: error.message
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
console.log(`  Storage: ☁️ Uploadcare (REST API)`);
console.log(`  Max file size: 10MB`);
console.log(`  Allowed formats: PDF, DOC, DOCX, JPG, PNG`);
console.log(`  Public Key: ${UPLOADCARE_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);
console.log('='.repeat(60));

export default upload;