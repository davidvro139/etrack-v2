const router = require('express').Router();
const { Op } = require('sequelize');
const { protect, requireWrite } = require('../middleware/auth');
const FollowUp = require('../models/FollowUp');
const Student = require('../models/Student');

// GET /api/followups — all incomplete, optionally filtered by studentId
router.get('/', protect, async (req, res, next) => {
  try {
    const { studentId, includeCompleted } = req.query;
    const where = {};
    if (studentId) where.studentId = Number(studentId);
    if (includeCompleted !== 'true') where.completedAt = null;
    const followups = await FollowUp.findAll({
      where,
      order: [['dueDate', 'ASC']],
    });

    // Attach student names
    const ids = [...new Set(followups.map((f) => f.studentId))];
    const students = ids.length ? await Student.findAll({ where: { id: ids } }) : [];
    const sMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const result = followups.map((f) => ({
      ...f.toJSON(),
      studentName: sMap[f.studentId]?.fullName || '',
      studentSisId: sMap[f.studentId]?.sisId || '',
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/followups
router.post('/', protect, requireWrite, async (req, res, next) => {
  try {
    const { studentId, note, dueDate } = req.body;
    if (!studentId || !dueDate) return res.status(400).json({ message: 'studentId and dueDate are required' });
    const followup = await FollowUp.create({
      studentId,
      note: note || '',
      dueDate,
      createdById: req.user.id,
      createdByName: req.user.name,
    });
    res.status(201).json(followup);
  } catch (err) {
    next(err);
  }
});

// PUT /api/followups/:id — update note/dueDate or mark complete
router.put('/:id', protect, requireWrite, async (req, res, next) => {
  try {
    const followup = await FollowUp.findByPk(req.params.id);
    if (!followup) return res.status(404).json({ message: 'Not found' });
    const { note, dueDate, completed } = req.body;
    const updates = {};
    if (note !== undefined) updates.note = note;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (completed === true) updates.completedAt = new Date();
    if (completed === false) updates.completedAt = null;
    await followup.update(updates);
    res.json(followup);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/followups/:id
router.delete('/:id', protect, requireWrite, async (req, res, next) => {
  try {
    const followup = await FollowUp.findByPk(req.params.id);
    if (!followup) return res.status(404).json({ message: 'Not found' });
    await followup.destroy();
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
