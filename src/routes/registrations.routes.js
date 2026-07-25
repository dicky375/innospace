import crypto from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Op } from 'sequelize';
import { authenticate, requireAffiliate, requireAdmin } from '../middleware/auth.js';
import { Registration, Program, User } from '../config/db.js';

const router = Router();

// ===== CONFIGURE MULTER FOR FILE UPLOADS =====
const uploadDir = path.join(process.cwd(), 'src', 'uploads', 'siws');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    cb(null, `${req.user.id}-${unique}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ===== CREATE REGISTRATION (Affiliate) =====
router.post('/', authenticate, requireAffiliate, upload.single('siwesForm'), async (req, res) => {
  try {
    const {
      programId,
      studentName,
      studentPhone,
      studentEmail,
      course,
      department,
      regNumber,
      hodName,
      supervisorName
    } = req.body;

    // Validate required fields
    if (!programId || !studentName || !studentPhone || !course || !department || !regNumber) {
      return res.status(400).json({
        success: false,
        error: 'programId, studentName, studentPhone, course, department and regNumber are required'
      });
    }

    // Check if program exists and is active
    const program = await Program.findByPk(programId);
    if (!program || !program.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Program not found or inactive'
      });
    }

    // Check for duplicate registration
    const duplicate = await Registration.findOne({
      where: {
        regNumber,
        programId,
        status: { [Op.in]: ['pending_approval', 'approved', 'paid'] }
      }
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'Student already registered for this program'
      });
    }

    // Create registration
    const registration = await Registration.create({
      programId,
      affiliateId: req.user.id,
      studentName,
      studentPhone,
      studentEmail: studentEmail || null,
      course,
      department,
      regNumber,
      hodName: hodName || null,
      supervisorName: supervisorName || null,
      amount: program.price,
      status: 'pending_approval',
      siwesFormPath: req.file ? req.file.path : null,
      siwesFormName: req.file ? req.file.originalname : null,
      siwesFormMimetype: req.file ? req.file.mimetype : null,
      siwesFormSize: req.file ? req.file.size : null
    });

    res.status(201).json({
      success: true,
      message: 'Registration submitted - pending admin approval',
      registration
    });
  } catch (err) {
    console.error('[REG] Create error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to create registration'
    });
  }
});
// ===== GET AFFILIATE'S REGISTRATIONS =====
router.get('/my', authenticate, requireAffiliate, async (req, res) => {
  try {
    const registrations = await Registration.findAll({
      where: { affiliateId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: registrations.length,
      registrations
    });
  } catch (err) {
    console.error('[REG] My registrations error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch registrations'
    });
  }
});

// ===== GET AFFILIATE STATS =====
router.get('/my/stats', authenticate, requireAffiliate, async (req, res) => {
  try {
    const affiliateId = req.user.id;

    const [total, pending, approved, paid, rejected] = await Promise.all([
      Registration.count({ where: { affiliateId } }),
      Registration.count({ where: { affiliateId, status: 'pending_approval' } }),
      Registration.count({ where: { affiliateId, status: 'approved' } }),
      Registration.count({ where: { affiliateId, status: 'paid' } }),
      Registration.count({ where: { affiliateId, status: 'rejected' } })
    ]);

    res.json({
      success: true,
      stats: {
        total,
        pending,
        approved,
        paid,
        rejected
      }
    });
  } catch (err) {
    console.error('[REG] Stats error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch stats'
    });
  }
});


   // ===== GET ALL REGISTRATIONS (Admin) =====
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const registrations = await Registration.findAll({
      order: [['createdAt', 'DESC']],
      raw: true
    });

    // Disable caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      count: registrations.length,
      registrations
    });
  } catch (err) {
    console.error('[REG] All registrations error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch registrations'
    });
  }
});

// ===== GET PENDING REGISTRATIONS (Admin) =====
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const registrations = await Registration.findAll({
      where: { status: 'pending_approval' },
      order: [['createdAt', 'ASC']],
      raw: true
    });

    // Disable caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      count: registrations.length,
      registrations
    });
  } catch (err) {
    console.error('[REG] Pending error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch pending registrations'
    });
  }
});




// ===== GET REGISTRATION BY ID =====
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the registration
    const registration = await Registration.findByPk(id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    // Check permissions (affiliate can only see their own registrations)
    if (req.user.role === 'affiliate' && registration.affiliateId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      registration
    });
  } catch (err) {
    console.error('[REG] Get error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch registration'
    });
  }
});

// ===== APPROVE REGISTRATION (Admin) =====
router.patch('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const registration = await Registration.findByPk(req.params.id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    if (registration.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve - status is ${registration.status}`
      });
    }

    // Calculate commission (10% of program price for internships, 0 for SIWES)
    const commission = registration.Program?.type === 'siwes'
      ? 0
      : parseFloat(registration.amount) * 0.10;

    await registration.update({
      status: 'approved',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      commissionEarned: commission
    });

    res.json({
      success: true,
      message: 'Registration approved',
      registration,
      commissionAssigned: commission
    });
  } catch (err) {
    console.error('[REG] Approve error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to approve registration'
    });
  }
});

// ===== REJECT REGISTRATION (Admin) =====
router.patch('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const registration = await Registration.findByPk(req.params.id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    if (registration.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject - status is ${registration.status}`
      });
    }

    await registration.update({
      status: 'rejected',
      rejectionReason: reason || null
    });

    res.json({
      success: true,
      message: 'Registration rejected',
      registration
    });
  } catch (err) {
    console.error('[REG] Reject error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to reject registration'
    });
  }
});

// ===== CANCEL REGISTRATION (Affiliate) =====
router.patch('/:id/cancel', authenticate, requireAffiliate, async (req, res) => {
  try {
    const registration = await Registration.findByPk(req.params.id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    if (registration.affiliateId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (registration.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel - status is ${registration.status}`
      });
    }

    // Delete uploaded file if exists
    if (registration.siwesFormPath && fs.existsSync(registration.siwesFormPath)) {
      fs.unlinkSync(registration.siwesFormPath);
    }

    await registration.update({ status: 'cancelled' });

    res.json({
      success: true,
      message: 'Registration cancelled'
    });
  } catch (err) {
    console.error('[REG] Cancel error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel registration'
    });
  }
});

export default router;