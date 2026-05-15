const router = require('express').Router();
const { protect } = require('../middleware/auth');
const CourseProgress = require('../models/CourseProgress');
const LmsEngagement = require('../models/LmsEngagement');

// GET /api/students/:id/progress
router.get('/:id/progress', protect, async (req, res, next) => {
  try {
    const [progress, engagement] = await Promise.all([
      CourseProgress.findAll({ where: { studentId: req.params.id } }),
      LmsEngagement.findAll({ where: { studentId: req.params.id } }),
    ]);
    res.json({ progress, engagement });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
