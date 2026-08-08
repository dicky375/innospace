// src/middleware/upload.js
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import path from 'path';
import fs from 'fs';

console.log('[Upload] 🔧 Cloudinary configured:');
console.log('  Cloud Name:', cloudinary.config().cloud_name);

// Create local uploads directory as fallback
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Configure Cloudinary storage with upload preset
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'innospace/siwes-forms',
    upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || 'innospace-unsigned',
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

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

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

console.log('='.repeat(60));
console.log('[Upload] Upload middleware configured:');
console.log(`  Storage: ☁️ Cloudinary`);
console.log(`  Max file size: 10MB`);
console.log(`  Allowed formats: PDF, DOC, DOCX, JPG, PNG`);
console.log(`  Upload Preset: ${process.env.CLOUDINARY_UPLOAD_PRESET || 'innospace-unsigned'}`);
console.log('='.repeat(60));

export default upload;