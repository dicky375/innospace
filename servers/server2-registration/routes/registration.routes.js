import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Op } from 'sequelize';
import { authenticate, requireAffiliate, requireAdmin } from '../../../middleware/auth.js';
import { getRedisClient } from '../../../shared/config/redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const COMMISSION_RATE_KEY = 'config:commission_rate';
const DEFAULT_COMMISSION_RATE = 0.10;

async function getCommissionRate() {
  try {
    const redis = await getRedisClient();
    const stored = await redis.get(COMMISSION_RATE_KEY);
    return stored ? parseFloat(stored) : DEFAULT_COMMISSION_RATE;
  } catch {
    return DEFAULT_COMMISSION_RATE;
  }
}

// ── Multer setup ───────────────────────────────────────────────────
const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default (Registration, Program, User) => {

  // ── POST /api/internal/sync-user — called by auth service only ─
  router.post('/sync-user', async (req, res) => {
    try {
      const serviceSecret = req.headers['x-service-secret'];
      if (!serviceSecret || serviceSecret !== process.env.INTERNAL_SERVICE_SECRET)
        return res.status(401).json({ error: 'Unauthorized' });

      const { id, name, email, password, phone, role, isActive } = req.body;

      await User.upsert({
        id,
        name,
        email,
        password,
        phone: phone || null,
        role,
        isActive: isActive ?? true,
      });

      console.log(`[REG] ✓ User synced: ${email}`);
      res.json({ message: 'User synced successfully' });
    } catch (err) {
      console.error('[REG] User sync error:', err.message);
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  // ── POST /api/registrations — affiliate registers a student ────
  router.post('/', authenticate, requireAffiliate, upload.single('siwesForm'), async (req, res) => {
    try {
      const affiliateId = req.user.id;
      const {
        programId, studentName, studentPhone, studentEmail,
        course, department, regNumber, hodName, supervisorName,
      } = req.body;

      if (!programId || !studentName || !studentPhone || !course || !department || !regNumber || !hodName || !supervisorName)
        return res.status(400).json({ error: 'All student details are required' });

      const program = await Program.findByPk(programId);
      if (!program || !program.isActive)
        return res.status(404).json({ error: 'Program not found or inactive' });

      const duplicate = await Registration.findOne({
        where: {
          regNumber,
          programId,
          status: { [Op.in]: ['pending_approval', 'approved', 'paid'] },
        },
      });
      if (duplicate)
        return res.status(409).json({ error: 'Student already registered for this program' });

      const rate = await getCommissionRate();
      const fee = parseFloat(program.monthlyFee);
      const commission = program.type === 'siwes' ? 0 : fee * rate;

      const registration = await Registration.create({
        programId,
        affiliateId,
        isSelfRegistered: false,
        studentName,
        studentPhone,
        studentEmail: studentEmail || null,
        course,
        department,
        regNumber,
        hodName,
        supervisorName,
        siwesFormPath: req.file ? req.file.filename : null,
        siwesFormName: req.file ? req.file.originalname : null,
        amount: fee,
        status: 'pending_approval',
        commissionEarned: 0,
      });

      res.status(201).json({
        message: 'Registration submitted — pending admin approval',
        registration,
        note: program.type === 'siwes'
          ? 'No commission for SIWES registrations'
          : `Commission of ₦${commission.toFixed(2)} (${(rate * 100).toFixed(0)}%) will be earned after approval`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  // ── GET /api/registrations/my — affiliate's own registrations ──
  router.get('/my', authenticate, requireAffiliate, async (req, res) => {
    try {
      const registrations = await Registration.findAll({
        where: { affiliateId: req.user.id },
        include: [{ model: Program, attributes: ['id', 'title', 'type', 'monthlyFee', 'affiliateCommission'] }],
        order: [['createdAt', 'DESC']],
      });
      res.json(registrations);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── GET /api/registrations/my/stats — affiliate dashboard stats ─
  router.get('/my/stats', authenticate, requireAffiliate, async (req, res) => {
    try {
      const affiliateId = req.user.id;

      const [total, pending, approved, paid, rejected] = await Promise.all([
        Registration.count({ where: { affiliateId } }),
        Registration.count({ where: { affiliateId, status: 'pending_approval' } }),
        Registration.count({ where: { affiliateId, status: 'approved' } }),
        Registration.count({ where: { affiliateId, status: 'paid' } }),
        Registration.count({ where: { affiliateId, status: 'rejected' } }),
      ]);

      const commissionResult = await Registration.findAll({
        where: { affiliateId, status: 'paid' },
        attributes: ['commissionEarned'],
      });
      const totalCommission = commissionResult.reduce(
        (sum, r) => sum + parseFloat(r.commissionEarned || 0), 0
      );

      res.json({
        total,
        pending,
        approved,
        paid,
        rejected,
        totalCommissionEarned: totalCommission.toFixed(2),
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── GET /api/registrations/pending — admin: all pending ────────
  router.get('/pending', authenticate, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const { count, rows } = await Registration.findAndCountAll({
        where: { status: 'pending_approval' },
        include: [{ model: Program, attributes: ['id', 'title', 'type', 'monthlyFee'] }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      res.json({
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        registrations: rows,
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── GET /api/registrations/all — admin: all registrations ──────
  router.get('/all', authenticate, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const { status } = req.query;

      const where = status ? { status } : {};

      const { count, rows } = await Registration.findAndCountAll({
        where,
        include: [{ model: Program, attributes: ['id', 'title', 'type'] }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      res.json({
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        registrations: rows,
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── GET /api/registrations/uploads/:filename — serve files ─────
  router.get('/uploads/:filename', authenticate, (req, res) => {
    const filePath = path.resolve(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  });

  // ── GET /api/registrations/:id — get single registration ───────
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const reg = await Registration.findByPk(req.params.id, {
        include: [{ model: Program }],
      });
      if (!reg) return res.status(404).json({ error: 'Registration not found' });

      if (req.user.role === 'affiliate' && reg.affiliateId !== req.user.id)
        return res.status(403).json({ error: 'Access denied' });

      res.json(reg);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── PATCH /api/registrations/:id/approve — admin approves ──────
  router.patch('/:id/approve', authenticate, requireAdmin, async (req, res) => {
    try {
      const reg = await Registration.findByPk(req.params.id, {
        include: [{ model: Program }],
      });
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.status !== 'pending_approval')
        return res.status(400).json({ error: `Cannot approve — status is ${reg.status}` });

      // Use current commission rate from Redis
      const rate = await getCommissionRate();
      const commission = reg.Program?.type === 'siwes'
        ? 0
        : parseFloat(reg.amount) * rate;

      await reg.update({
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        commissionEarned: commission,
      });

      res.json({
        message: 'Registration approved',
        registration: reg,
        commissionAssigned: commission,
        commissionRate: `${(rate * 100).toFixed(0)}%`,
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── PATCH /api/registrations/:id/reject — admin rejects ────────
  router.patch('/:id/reject', authenticate, requireAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      const reg = await Registration.findByPk(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.status !== 'pending_approval')
        return res.status(400).json({ error: `Cannot reject — status is ${reg.status}` });

      await reg.update({ status: 'rejected', rejectionReason: reason || null });
      res.json({ message: 'Registration rejected', registration: reg });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── PATCH /api/registrations/:id/cancel — affiliate cancels ────
  router.patch('/:id/cancel', authenticate, requireAffiliate, async (req, res) => {
    try {
      const reg = await Registration.findByPk(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.affiliateId !== req.user.id)
        return res.status(403).json({ error: 'Access denied' });
      if (reg.status !== 'pending_approval')
        return res.status(400).json({ error: `Cannot cancel — status is ${reg.status}` });

      await reg.update({ status: 'cancelled' });
      res.json({ message: 'Registration cancelled', registration: reg });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── PATCH /api/registrations/:id/mark-paid — payment service ───
  router.patch('/:id/mark-paid', async (req, res) => {
    try {
      const serviceSecret = req.headers['x-service-secret'];
      if (!serviceSecret || serviceSecret !== process.env.INTERNAL_SERVICE_SECRET)
        return res.status(401).json({ error: 'Unauthorized' });

      const { paystackRef, commission } = req.body;
      const reg = await Registration.findByPk(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.status !== 'approved')
        return res.status(400).json({ error: `Cannot mark paid — status is ${reg.status}` });

      await reg.update({
        status: 'paid',
        paystackRef,
        commissionEarned: commission ?? reg.commissionEarned,
      });
      res.json(reg);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};