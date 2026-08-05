import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Check if Cloudinary is properly configured
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('[Cloudinary] ⚠️ Missing Cloudinary credentials! File uploads will fail.');
}

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'innospace/siwes-forms',
    allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    resource_type: 'auto',
    public_id: (req, file) => {
      const unique = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const name = `${req.user.id}-${unique}-${file.originalname.split('.')[0]}`;
      console.log(`[Cloudinary] Generating public_id: ${name}`);
      return name;
    },
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  console.log(`[Cloudinary] File upload: ${file.originalname} (${ext})`);
  
  if (allowed.includes(ext)) {
    console.log('[Cloudinary] ✅ File type accepted');
    cb(null, true);
  } else {
    console.log('[Cloudinary] ❌ File type rejected:', ext);
    cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Log upload configuration
console.log('[Cloudinary] Upload middleware configured');
console.log(`[Cloudinary] Max file size: 10MB`);
console.log(`[Cloudinary] Allowed formats: PDF, DOC, DOCX, JPG, PNG`);

export default upload;