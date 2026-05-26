import { Router } from 'express';
import { authenticate, requireAdmin } from '../../../middleware/auth.js';
import { getRedisClient, KEYS } from '../../../shared/config/redis.js';

const router = Router();

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
    res.json({ source: 'db', programs });
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
      res.json(program);
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
        return res.status(400).json({ error: 'type must be regular or siwes' });

      const program = await Program.create({ title, description, monthlyFee, durationMonths, type: type || 'regular', category });

      // Invalidate cache
      const redis = await getRedisClient();
      await redis.del(KEYS.programs());

      res.status(201).json(program);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/programs/:id — admin only
  router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const program = await Program.findByPk(req.params.id);
      if (!program) return res.status(404).json({ error: 'Program not found' });
      await program.update(req.body);
      const redis = await getRedisClient();
      await redis.del(KEYS.programs());
      res.json(program);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // DELETE /api/programs/:id — admin only (soft delete)
  router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const program = await Program.findByPk(req.params.id);
      if (!program) return res.status(404).json({ error: 'Program not found' });
      await program.update({ isActive: false });
      const redis = await getRedisClient();
      await redis.del(KEYS.programs());
      res.json({ message: 'Program deactivated' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};