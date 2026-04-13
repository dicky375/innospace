import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticate, requireAffiliate, requireAdmin } from '../../../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

export default (Registration, Program) => {

  // POST /api/registrations — affiliate registers a student
  router.post('/', authenticate, requireAffiliate, upload.single('siwesForm'), async (req, res) => {
    try {
      const affiliateId = req.user.id;
      const {
        programId, studentName, studentPhone, studentEmail,
        course, department, regNumber, hodName, supervisorName,
      } = req.body;

      // Validate required fields
      if (!programId || !studentName || !studentPhone || !course || !department || !regNumber || !hodName || !supervisorName)
        return res.status(400).json({ error: 'All student details are required' });

      const program = await Program.findByPk(programId);
      if (!program || !program.isActive)
        return res.status(404).json({ error: 'Program not found or inactive' });

      // Check duplicate by reg number + program
      const duplicate = await Registration.findOne({
        where: { regNumber, programId, status: ['pending_approval', 'approved', 'paid'] },
      });
      if (duplicate)
        return res.status(409).json({ error: 'Student already registered for this program' });

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
        amount: program.monthlyFee,
        status: 'pending_approval',
        commissionEarned: 0,
      });

      res.status(201).json({
        message: 'Registration submitted — pending admin approval',
        registration,
        note: program.type === 'siwes'
          ? 'No commission for SIWES registrations'
          : '5% commission will be earned after approval and first payment',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  // GET /api/registrations/my — affiliate sees their own registrations
  router.get('/my', authenticate, requireAffiliate, async (req, res) => {
    try {
      const registrations = await Registration.findAll({
        where: { affiliateId: req.user.id },
        include: [{ model: Program }],
        order: [['createdAt', 'DESC']],
      });
      res.json(registrations);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/registrations/mine — student sees their own registrations
  router.get('/mine', authenticate, async (req, res) => {
    try {
      const registrations = await Registration.findAll({
        where: { studentEmail: req.user.email },
        include: [{ model: Program }],
        order: [['createdAt', 'DESC']],
      });
      res.json(registrations);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/registrations/pending — admin sees all pending
  router.get('/pending', authenticate, requireAdmin, async (req, res) => {
    try {
      const registrations = await Registration.findAll({
        where: { status: 'pending_approval' },
        include: [{ model: Program }],
        order: [['createdAt', 'DESC']],
      });
      res.json(registrations);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/registrations/all — admin sees all
  router.get('/all', authenticate, requireAdmin, async (req, res) => {
    try {
      const registrations = await Registration.findAll({
        include: [{ model: Program }],
        order: [['createdAt', 'DESC']],
      });
      res.json(registrations);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/registrations/uploads/:filename — serve uploaded files
  router.get('/uploads/:filename', authenticate, (req, res) => {
    const filePath = path.resolve(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  });

  // PATCH /api/registrations/:id/approve — admin approves
  router.patch('/:id/approve', authenticate, requireAdmin, async (req, res) => {
    try {
      const reg = await Registration.findByPk(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.status !== 'pending_approval')
        return res.status(400).json({ error: `Cannot approve — status is ${reg.status}` });
      await reg.update({ status: 'approved', approvedBy: req.user.id, approvedAt: new Date() });
      res.json({ message: 'Registration approved', registration: reg });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/registrations/:id/reject — admin rejects
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

  // PATCH /api/registrations/:id/mark-paid — called by Server 3
  router.patch('/:id/mark-paid', async (req, res) => {
    try {
      const { paystackRef, commission } = req.body;
      const reg = await Registration.findByPk(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      await reg.update({ status: 'paid', paystackRef, commissionEarned: commission || 0 });
      res.json(reg);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};