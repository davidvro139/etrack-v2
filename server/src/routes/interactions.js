const router = require('express').Router();
const { protect, requireWrite } = require('../middleware/auth');
const Interaction = require('../models/Interaction');

// GET /api/students/:id/interactions
router.get('/:id/interactions', protect, async (req, res, next) => {
  try {
    const items = await Interaction.findAll({
      where: { studentId: req.params.id },
      order: [['date', 'DESC']],
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/students/:id/interactions
router.post('/:id/interactions', protect, requireWrite, async (req, res, next) => {
  try {
    const item = await Interaction.create({
      ...req.body,
      studentId: req.params.id,
      instructorId: req.user.id,
      instructorName: req.user.name,
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/students/:id/interactions/:iid
router.put('/:id/interactions/:iid', protect, requireWrite, async (req, res, next) => {
  try {
    const item = await Interaction.findOne({
      where: { id: req.params.iid, studentId: req.params.id },
    });
    if (!item) return res.status(404).json({ message: 'Interaction not found' });
    await item.update(req.body);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/students/:id/interactions/:iid
router.delete('/:id/interactions/:iid', protect, requireWrite, async (req, res, next) => {
  try {
    const item = await Interaction.findOne({
      where: { id: req.params.iid, studentId: req.params.id },
    });
    if (!item) return res.status(404).json({ message: 'Interaction not found' });
    await item.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
