import { Router } from 'express';
import { authenticate, requireIntern, requireAdmin } from '../../../shared/config/middleware/auth.js';

const router = Router();

export default (Registration, Program) => {

  // POST /api/registrations — intern registers someone else OR self-registration
  router.post('/', authenticate, async (req, res) => {
    try {
      const { programId, registeredUserId } = req.body;
      const requesterId = req.user.id;

      if (!programId || !registeredUserId)
        return res.status(400).json({ error: 'programId and registeredUserId required' });

      const isSelfRegistered = requesterId === registeredUserId;

      // Only interns can register others
      if (!isSelfRegistered && req.user.role !== 'intern')
        return res.status(403).json({ error: 'Only interns can register other users' });

      const program = await Program.findByPk(programId);
      if (!program || !program.isActive)
        return res.status(404).json({ error: 'Program not found or inactive' });

      // Check duplicate
      const duplicate = await Registration.findOne({
        where: {
          programId,
          registeredUserId,
          status: ['pending_approval', 'approved', 'paid'],
        },
      });
      if (duplicate)
        return res.status(409).json({ error: 'User already registered for this program' });

      const registration = await Registration.create({
        programId,
        registeredUserId,
        internId: isSelfRegistered ? null : requesterId,
        isSelfRegistered,
        amount: program.monthlyFee,
        status: 'pending_approval',
        commissionEarned: 0,
      });

      res.status(201).json({
        message: isSelfRegistered
          ? 'Self-registration submitted — pending admin approval'
          : 'Registration submitted — pending admin approval',
        registration,
        note: isSelfRegistered ? 'No commission applies for self-registration' : '5% commission will be earned after approval and first payment',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/registrations/pending — admin sees all pending approvals
  router.get('/pending', authenticate, requireAdmin, async (req, res) => {
    try {
      const registrations = await Registration.findAll({
        where: { status: 'pending_approval' },
        include: [{ model: Program }],
      });
      res.json(registrations);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/registrations/:id/approve — admin approves
  router.patch('/:id/approve', authenticate, requireAdmin, async (req, res) => {
    try {
      const reg = await Registration.findByPk(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.status !== 'pending_approval')
        return res.status(400).json({ error: `Cannot approve a registration with status: ${reg.status}` });

      await reg.update({
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
      });

      res.json({
        message: 'Registration approved — user can now proceed to payment',
        registration: reg,
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/registrations/:id/reject — admin rejects
  router.patch('/:id/reject', authenticate, requireAdmin, async (req, res) => {
    try {
      const reg = await Registration.findByPk(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.status !== 'pending_approval')
        return res.status(400).json({ error: `Cannot reject a registration with status: ${reg.status}` });

      await reg.update({ status: 'rejected' });
      res.json({ message: 'Registration rejected', registration: reg });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/registrations/my — intern sees their own submitted registrations
  router.get('/my', authenticate, requireIntern, async (req, res) => {
    try {
      const registrations = await Registration.findAll({
        where: { internId: req.user.id },
        include: [{ model: Program }],
      });
      res.json(registrations);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/registrations/:id/mark-paid — called by Server 3 after payment
  router.patch('/:id/mark-paid', async (req, res) => {
    try {
      const { paystackRef, commission } = req.body;
      const reg = await Registration.findByPk(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.status !== 'approved')
        return res.status(400).json({ error: 'Registration must be approved before marking as paid' });

      await reg.update({ status: 'paid', paystackRef, commissionEarned: commission || 0 });
      res.json(reg);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};