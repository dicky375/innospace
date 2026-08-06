import crypto from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Op } from 'sequelize';
import { authenticate, requireAffiliate, requireAdmin } from '../middleware/auth.js';
import { Registration, Program, User } from '../config/db.js';
import { getRedisClient, KEYS } from '../config/redis.js';
import upload from '../middleware/upload.js'; 

const router = Router();



// ===== CREATE REGISTRATION (Affiliate) =====
router.post('/', authenticate, requireAffiliate, upload('siwesForm'), async (req, res) => {
  try {
        console.log('[REG] 📝 Registration request received');
    console.log('[REG] 📎 File uploaded:', req.file ? req.file.originalname : 'No file');

    const {
      programId,
      studentName,
      studentPhone,
      studentEmail,
      course,
      department,
      regNumber,
      hodName,
      supervisorName,
      schoolName
    } = req.body;

    if (!programId || !studentName || !studentPhone || !course || !department || !regNumber) {
      return res.status(400).json({
        success: false,
        error: 'programId, studentName, studentPhone, course, department and regNumber are required'
      });
    }

    const program = await Program.findByPk(programId);
    if (!program || !program.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Program not found or inactive'
      });
    }

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

    const registration = await Registration.create({
      programId,
      affiliateId: req.user.id,
      studentName,
      studentPhone,
      studentEmail: studentEmail || null,
      schoolName: req.body.schoolName || null,
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
      include: [
        { 
          model: Program, 
          as: 'program',
          attributes: ['id', 'title', 'type', 'price']
        },
        { 
          model: User, 
          as: 'affiliate',
          attributes: ['id', 'name', 'email']
        }
      ],
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

// ===== GET REGISTRATION FILE (Admin/Affiliate) =====
router.get('/file/:id', authenticate, async (req, res) => {
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

    // Check permissions: admin or the affiliate who created it
    if (req.user.role !== 'admin' && registration.affiliateId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if file exists
    if (!registration.siwesFormPath) {
      return res.status(404).json({
        success: false,
        error: 'No file attached to this registration'
      });
    }

    // ✅ Redirect to the Uploadcare CDN URL
    // The URL is already stored in siwesFormPath
    return res.redirect(registration.siwesFormPath);

  } catch (err) {
    console.error('[REG] File view error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve file'
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
    const { status } = req.query;
    
    const where = {};
    if (status) {
      where.status = status;
    }

    const registrations = await Registration.findAll({
      where,
      include: [
        { 
          model: Program, 
          as: 'program',
          attributes: ['id', 'title', 'type', 'price']
        },
        { 
          model: User, 
          as: 'affiliate',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

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
      include: [
        { 
          model: Program, 
          as: 'program',
          attributes: ['id', 'title', 'type', 'price']
        },
        { 
          model: User, 
          as: 'affiliate',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

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
    
    const registration = await Registration.findByPk(id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

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
    const registration = await Registration.findByPk(req.params.id, {
      include: [{ model: Program, as: 'program' }]
    });
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    // Allow approval of pending_approval OR paid registrations
    if (registration.status !== 'pending_approval' && registration.status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve - status is ${registration.status}`
      });
    }

    // Calculate commission
    const commission = registration.program?.type === 'siwes'
      ? 0
      : parseFloat(registration.amount) * 0.10;

    // Update status only if it's pending
    const updateData = {
      approvedBy: req.user.id,
      approvedAt: new Date(),
      commissionEarned: commission
    };
    
    if (registration.status === 'pending_approval') {
      updateData.status = 'approved';
    }
    
    await registration.update(updateData);

    // ✅ CREDIT COMMISSION TO REDIS (affiliate balance)
    if (commission > 0 && registration.affiliateId) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          await redis.incrbyfloat(
            KEYS.affiliateBalance(registration.affiliateId),
            commission
          );
          await redis.zincrby(
            KEYS.leaderboard(),
            commission,
            registration.affiliateId
          );
          console.log(`[REG] ✅ Commission credited to Redis: ₦${commission} for affiliate ${registration.affiliateId}`);
        } else {
          console.warn('[REG] ⚠️ Redis not available, commission not credited');
        }
      } catch (redisErr) {
        console.error('[REG] ❌ Redis credit failed:', redisErr.message);
      }
    }

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
      error: err.message || 'Failed to approve registration'
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

// ===== TEMPORARY: Credit all commissions to Redis =====
router.post('/credit-all', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('[REG] 🔄 Starting commission credit...');
    const redis = await getRedisClient();
    if (!redis) {
      console.error('[REG] ❌ Redis not available');
      return res.status(500).json({ error: 'Redis not available' });
    }

    const registrations = await Registration.findAll({
      where: {
        status: 'approved',
        commissionEarned: { [Op.gt]: 0 }
      }
    });

    console.log(`[REG] 📊 Found ${registrations.length} registrations with commissions`);

    let total = 0;
    const results = [];

    for (const reg of registrations) {
      const commission = parseFloat(reg.commissionEarned);
      if (commission > 0 && reg.affiliateId) {
        await redis.incrbyfloat(
          KEYS.affiliateBalance(reg.affiliateId),
          commission
        );
        await redis.zincrby(
          KEYS.leaderboard(),
          commission,
          reg.affiliateId
        );
        total += commission;
        results.push({
          registrationId: reg.id,
          affiliateId: reg.affiliateId,
          studentName: reg.studentName,
          commission: commission
        });
        console.log(`[REG] ✅ Credited ₦${commission} to ${reg.affiliateId}`);
      }
    }

    console.log(`[REG] ✅ Total credited: ₦${total.toFixed(2)}`);

    res.json({
      success: true,
      message: `Credited ₦${total.toFixed(2)} total commission to ${results.length} registrations`,
      total: total.toFixed(2),
      count: results.length,
      results
    });
  } catch (err) {
    console.error('[REG] ❌ Credit all error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== MARK REGISTRATION AS PAID (Internal - called by payment service) =====
router.patch('/:id/mark-paid', async (req, res) => {
  try {
    // Verify service secret for security
    const serviceSecret = req.headers['x-service-secret'];
    if (!serviceSecret || serviceSecret !== process.env.INTERNAL_SERVICE_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { id } = req.params;
    const { paystackRef, commission } = req.body;

    const registration = await Registration.findByPk(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    // Only allow marking as paid if status is 'approved' or 'pending_approval'
    if (registration.status !== 'approved' && registration.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        error: `Cannot mark as paid - status is ${registration.status}`
      });
    }

    await registration.update({
      status: 'paid',
      paystackRef: paystackRef || null,
      commissionEarned: commission || registration.commissionEarned
    });

    res.json({
      success: true,
      message: 'Registration marked as paid',
      registration
    });
  } catch (err) {
    console.error('[REG] Mark paid error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to mark registration as paid'
    });
  }
});

// ===== MANUALLY MARK REGISTRATION AS PAID (Admin only - for testing) =====
router.patch('/:id/mark-paid-admin', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { paystackRef } = req.body;

    const registration = await Registration.findByPk(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    if (registration.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Registration is already paid'
      });
    }

    await registration.update({
      status: 'paid',
      paystackRef: paystackRef || `manual_${Date.now()}`
    });

    res.json({
      success: true,
      message: 'Registration marked as paid (manual)',
      registration
    });
  } catch (err) {
    console.error('[REG] Manual mark paid error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to mark registration as paid'
    });
  }
});

export default router;