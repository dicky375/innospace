
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
//import { convertDocxToPdf } from '../utils/fileConverter.js'; // Option 1

const CLOUD_NAME = 'dd4bxsolt';
const UPLOAD_PRESET = 'innospace-unsigned';

console.log('[Upload] 🔧 Cloudinary configured:');
console.log('  Cloud Name:', CLOUD_NAME);
console.log('  Upload Preset:', UPLOAD_PRESET);

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

// ✅ Upload to Cloudinary with DOCX to PDF conversion
const uploadToCloudinary = async (buffer, originalname) => {
  try {
    let fileBuffer = buffer;
    let fileName = originalname;
    let fileMimetype = originalname.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
    
    // ✅ If DOCX, convert to PDF first
    if (originalname.endsWith('.docx')) {
      console.log('[Upload] 📄 Converting DOCX to PDF...');
      const converted = await convertDocxToPdf(buffer, originalname);
      fileBuffer = converted.buffer;
      fileName = converted.filename;
      fileMimetype = converted.mimetype;
      console.log('[Upload] ✅ Conversion complete');
    }

    console.log(`[Upload] 📤 Uploading to Cloudinary: ${fileName}`);
    console.log(`[Upload] File size: ${fileBuffer.length} bytes`);

    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: fileMimetype
    });
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'innospace/siwes-forms');

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 30000
      }
    );

    // ✅ Store original name in metadata
    response.data.originalName = originalname;
    response.data.isConverted = originalname.endsWith('.docx');

    console.log('[Upload] ✅ Cloudinary upload successful:', response.data.secure_url);
    return response.data;
  } catch (error) {
    console.error('[Upload] ❌ Cloudinary error:');
    console.error('  Message:', error.response?.data?.error?.message || error.message);
    throw error;
  }
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
        
        const result = await uploadToCloudinary(
          req.file.buffer,
          req.file.originalname
        );
        
        req.file.path = result.secure_url;
        req.file.secure_url = result.secure_url;
        req.file.filename = result.public_id;
        req.file.originalName = result.originalName;
        req.file.isConverted = result.isConverted;
        delete req.file.buffer;
        
        console.log('[Upload] ✅ Upload complete:', req.file.path);
        next();
      } catch (error) {
        console.error('[Upload] ❌ Error:', error.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to upload file',
          details: error.message
        });
      }
    });
  };
};

console.log('='.repeat(60));
console.log('[Upload] Upload middleware configured:');
console.log(`  Storage: ☁️ Cloudinary`);
console.log(`  Max file size: 10MB`);
console.log(`  Allowed formats: PDF, DOC, DOCX, JPG, PNG`);
console.log(`  Upload Preset: ${UPLOAD_PRESET}`);
console.log('='.repeat(60));

export default upload;