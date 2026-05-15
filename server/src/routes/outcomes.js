const router = require('express').Router();
const { protect, requireWrite } = require('../middleware/auth');
const Outcome = require('../models/Outcome');

// GET /api/students/:id/outcomes
router.get('/:id/outcomes', protect, async (req, res, next) => {
  try {
    const items = await Outcome.findAll({
      where: { studentId: req.params.id },
      order: [['date', 'DESC']],
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/students/:id/outcomes
router.post('/:id/outcomes', protect, requireWrite, async (req, res, next) => {
  try {
    const item = await Outcome.create({ ...req.body, studentId: req.params.id });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/students/:id/outcomes/:oid
router.put('/:id/outcomes/:oid', protect, requireWrite, async (req, res, next) => {
  try {
    const item = await Outcome.findOne({
      where: { id: req.params.oid, studentId: req.params.id },
    });
    if (!item) return res.status(404).json({ message: 'Outcome not found' });
    await item.update(req.body);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/students/:id/outcomes/:oid
router.delete('/:id/outcomes/:oid', protect, requireWrite, async (req, res, next) => {
  try {
    const item = await Outcome.findOne({
      where: { id: req.params.oid, studentId: req.params.id },
    });
    if (!item) return res.status(404).json({ message: 'Outcome not found' });
    await item.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
