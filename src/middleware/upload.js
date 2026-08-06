// src/middleware/upload.js
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';

// ✅ Cloudinary credentials
const CLOUD_NAME = 'dd4bxsolt';
const API_KEY = '631292745235875';
const API_SECRET = 'ZkQQXurB1IHBQEC-Bm0wHXyF7Xg';

console.log('[Upload] 🔧 Cloudinary configured:');
console.log('  Cloud Name:', CLOUD_NAME);
console.log('  API Key:', API_KEY ? '✅ Set' : '❌ Missing');

// Create local uploads directory as fallback
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

// ✅ Upload to Cloudinary using axios with upload preset (NO SIGNATURE)
const uploadToCloudinary = (buffer, originalname, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const baseName = originalname.replace(/\.[^.]+$/, '');
      const publicId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}-${baseName}`;
      
      console.log(`[Upload] 📤 Uploading to Cloudinary:`, {
        publicId,
        size: buffer.length,
        preset: 'innospace-unsigned'
      });

      // ✅ Create form data with upload preset (NO SIGNATURE NEEDED)
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: originalname,
        contentType: originalname.endsWith('.pdf') ? 'application/pdf' : 
                     originalname.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                     originalname.endsWith('.doc') ? 'application/msword' :
                     'application/octet-stream'
      });
      // ✅ Use the upload preset that worked in your direct test
      formData.append('upload_preset', 'innospace-unsigned');
      formData.append('public_id', publicId);
      formData.append('folder', 'innospace/siwes-forms');
      formData.append('resource_type', 'auto');
      formData.append('allowed_formats', 'pdf,doc,docx,jpg,jpeg,png');

      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
      
      console.log('[Upload] 📡 Sending to Cloudinary...');
      
      const response = await axios.post(url, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 30000
      });

      console.log('[Upload] ✅ Upload successful:', response.data.secure_url);
      resolve(response.data);

    } catch (error) {
      console.error('[Upload] ❌ Cloudinary error:');
      console.error('  Message:', error.response?.data?.error?.message || error.message);
      console.error('  Status:', error.response?.status);
      console.error('  Data:', error.response?.data);
      
      reject(new Error(error.response?.data?.error?.message || error.message));
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
        console.error('[Upload] ❌ Error:', error.message);
        
        // ✅ Send detailed error response
        return res.status(500).json({
          success: false,
          error: 'Failed to upload file to cloud storage',
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
console.log(`  Storage: ☁️ Cloudinary (axios + upload preset)`);
console.log(`  Max file size: 10MB`);
console.log(`  Allowed formats: PDF, DOC, DOCX, JPG, PNG`);
console.log(`  Upload Preset: innospace-unsigned`);
console.log('='.repeat(60));

export default upload;