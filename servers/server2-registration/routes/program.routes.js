import { Router } from 'express';
import { authenticate, requireAdmin } from '../../../middleware/auth.js';
import { getRedisClient, KEYS } from '../../../shared/config/redis.js';

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

export default (Program) => {

  // GET /api/programs — public
  router.get('/', async (req, res) => {
    try {
      try {
        const redis = await getRedisClient();
        const cached = await redis.get(KEYS.programs());
        if (cached) return res.json({ source: 'cache', programs: JSON.parse(cached) });
      } catch (redisErr) {
        console.warn('[Redis] Cache unavailable, falling back to DB');
      }

      const programs = await Program.findAll({ where: { isActive: true } });

      // Attach dynamic commission to each program
      const rate = await getCommissionRate();
      const programsWithCommission = programs.map(p => ({
        ...p.toJSON(),
        commissionRate: (rate * 100).toFixed(1),
        commissionAmount: (parseFloat(p.monthlyFee) * rate).toFixed(2),
      }));

      try {
        const redis = await getRedisClient();
        await redis.set(KEYS.programs(), JSON.stringify(programsWithCommission), 'EX', 300);
      } catch {}

      res.json({ source: 'db', programs: programsWithCommission });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/programs/:id — public
  router.get('/:id', async (req, res) => {
    try {
      const program = await Program.findByPk(req.params.id);
      if (!program) return res.status(404).json({ error: 'Program not found' });

      const rate = await getCommissionRate();
      res.json({
        ...program.toJSON(),
        commissionRate: (rate * 100).toFixed(1),
        commissionAmount: (parseFloat(program.monthlyFee) * rate).toFixed(2),
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/programs — admin only
  router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
      const { title, description, monthlyFee, durationMonths, type, category } = req.body;

      if (!title || !monthlyFee || !durationMonths)
        return res.status(400).json({ error: 'title, monthlyFee and durationMonths are required' });
      if (!['internship', 'siwes'].includes(type))
        return res.status(400).json({ error: 'type must be internship or siwes' });

      const program = await Program.create({
        title,
        description,
        monthlyFee,
        durationMonths,
        type,
        category,
      });

      // Invalidate cache
      try {
        const redis = await getRedisClient();
        await redis.del(KEYS.programs());
      } catch {}

      res.status(201).json(program);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/programs/:id — admin only (edit all fields)
  router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const program = await Program.findByPk(req.params.id);
      if (!program) return res.status(404).json({ error: 'Program not found' });

      const { title, description, monthlyFee, durationMonths, type, category, isActive } = req.body;

      // Only update fields that were sent
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (monthlyFee !== undefined) updates.monthlyFee = monthlyFee;
      if (durationMonths !== undefined) updates.durationMonths = durationMonths;
      if (type !== undefined) {
        if (!['internship', 'siwes'].includes(type))
          return res.status(400).json({ error: 'type must be internship or siwes' });
        updates.type = type;
      }
      if (category !== undefined) updates.category = category;
      if (isActive !== undefined) updates.isActive = isActive;

      await program.update(updates);

      // Invalidate cache
      try {
        const redis = await getRedisClient();
        await redis.del(KEYS.programs());
      } catch {}

      res.json({ message: 'Program updated', program });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // DELETE /api/programs/:id — admin only (soft delete)
  router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const program = await Program.findByPk(req.params.id);
      if (!program) return res.status(404).json({ error: 'Program not found' });
      await program.update({ isActive: false });
      try {
        const redis = await getRedisClient();
        await redis.del(KEYS.programs());
      } catch {}
      res.json({ message: 'Program deactivated' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};