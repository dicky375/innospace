// middleware/upload.js
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
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

// ✅ Configure Cloudinary storage
let storage;
let useCloudinary = false;

try {
  if (hasCloudinaryCredentials) {
    // ✅ Test Cloudinary connection before using it
    const testResult = await cloudinary.api.ping();
    console.log('[Upload] ✅ Cloudinary connection test:', testResult.status);
    useCloudinary = true;
    
    storage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'innospace/siwes-forms',
        allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
        resource_type: 'auto',
        public_id: (req, file) => {
          const unique = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          const name = `${req.user?.id || 'anonymous'}-${unique}-${file.originalname.split('.')[0]}`;
          console.log(`[Upload] Generating public_id: ${name}`);
          return name;
        },
      },
    });
    console.log('[Upload] ✅ Cloudinary storage configured');
  }
} catch (err) {
  console.error('[Upload] ❌ Cloudinary connection failed:', err.message);
  console.warn('[Upload] ⚠️ Falling back to local storage');
  useCloudinary = false;
}

// ✅ Fallback to local storage if Cloudinary is not available
if (!useCloudinary) {
  console.log('[Upload] Using local storage fallback');
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const name = `${req.user?.id || 'anonymous'}-${unique}-${file.originalname}`;
      cb(null, name);
    }
  });
}

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
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

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
console.log(`  Storage: ${useCloudinary ? '☁️ Cloudinary' : '💾 Local'}`);
console.log(`  Max file size: 10MB`);
console.log(`  Allowed formats: PDF, DOC, DOCX, JPG, PNG`);
console.log('='.repeat(60));

export default upload;