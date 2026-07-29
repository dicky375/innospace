import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { Program, sequelize } from '../config/db.js';
import { Op } from 'sequelize';

const router = Router();

// ===== GET ALL PROGRAMS (Public) =====
router.get('/', async (req, res) => {
  try {
    const { isActive, type, search } = req.query;
    
    // Build where clause
    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.title = { [Op.iLike]: `%${search}%` };
    }

    const programs = await Program.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      count: programs.length,
      programs
    });
  } catch (err) {
    console.error('[PROGRAMS] List error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch programs' 
    });
  }
});

// ===== GET PROGRAM BY ID (Public) =====
router.get('/:id', async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id);
    
    if (!program) {
      return res.status(404).json({ 
        success: false,
        error: 'Program not found' 
      });
    }
    
    res.json({
      success: true,
      program
    });
  } catch (err) {
    console.error('[PROGRAMS] Get error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch program' 
    });
  }
});

// ===== CREATE PROGRAM (Admin only) =====
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      price, 
      monthlyFee, 
      durationMonths, 
      type, 
      category,
      affiliateCommission,
      currency 
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ 
        success: false,
        error: 'Title is required' 
      });
    }
    if (!price || price <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid price is required' 
      });
    }
    if (!monthlyFee || monthlyFee <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid monthly fee is required' 
      });
    }
    if (!durationMonths || durationMonths < 1) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid duration in months is required' 
      });
    }

    // Create program
    const program = await Program.create({
      title,
      description: description || null,
      price,
      monthlyFee,
      durationMonths,
      type: type || 'internship',
      category: category || null,
      affiliateCommission: affiliateCommission || 35000,
      currency: currency || 'NGN',
      createdBy: req.user.id,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Program created successfully',
      program
    });
  } catch (err) {
    console.error('[PROGRAMS] Create error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create program' 
    });
  }
});

// ===== UPDATE PROGRAM (Admin only) =====
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      price, 
      monthlyFee, 
      durationMonths, 
      type, 
      category,
      affiliateCommission,
      isActive,
      currency 
    } = req.body;

    const program = await Program.findByPk(id);
    
    if (!program) {
      return res.status(404).json({ 
        success: false,
        error: 'Program not found' 
      });
    }

    // Build update object (only include fields that are provided)
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (monthlyFee !== undefined) updates.monthlyFee = monthlyFee;
    if (durationMonths !== undefined) updates.durationMonths = durationMonths;
    if (type !== undefined) updates.type = type;
    if (category !== undefined) updates.category = category;
    if (affiliateCommission !== undefined) updates.affiliateCommission = affiliateCommission;
    if (isActive !== undefined) updates.isActive = isActive;
    if (currency !== undefined) updates.currency = currency;

    await program.update(updates);

    res.json({
      success: true,
      message: 'Program updated successfully',
      program
    });
  } catch (err) {
    console.error('[PROGRAMS] Update error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update program' 
    });
  }
});

// ===== DELETE PROGRAM (Admin only - Soft Delete) =====
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const program = await Program.findByPk(id);
    
    if (!program) {
      return res.status(404).json({ 
        success: false,
        error: 'Program not found' 
      });
    }

    // Soft delete by setting isActive to false
    await program.update({ isActive: false });

    res.json({
      success: true,
      message: 'Program deactivated successfully'
    });
  } catch (err) {
    console.error('[PROGRAMS] Delete error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete program' 
    });
  }
});

// ===== RESTORE PROGRAM (Admin only) =====
router.patch('/:id/restore', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const program = await Program.findByPk(id);
    
    if (!program) {
      return res.status(404).json({ 
        success: false,
        error: 'Program not found' 
      });
    }

    await program.update({ isActive: true });

    res.json({
      success: true,
      message: 'Program restored successfully',
      program
    });
  } catch (err) {
    console.error('[PROGRAMS] Restore error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to restore program' 
    });
  }
});
// ===== GET PROGRAM STATS (Admin only) - SIMPLIFIED =====
router.get('/stats/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const totalPrograms = await Program.count();
    const activePrograms = await Program.count({ where: { isActive: true } });
    const inactivePrograms = await Program.count({ where: { isActive: false } });

    res.json({
      success: true,
      stats: {
        total: totalPrograms,
        active: activePrograms,
        inactive: inactivePrograms
      }
    });
  } catch (err) {
    console.error('[PROGRAMS] Stats error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch program stats'
    });
  }
});

export default router;