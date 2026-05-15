const router = require('express').Router();
const { Op } = require('sequelize');
const { protect, requireWrite } = require('../middleware/auth');
const Student = require('../models/Student');
const Interaction = require('../models/Interaction');
const Outcome = require('../models/Outcome');
const CourseProgress = require('../models/CourseProgress');
const LmsEngagement = require('../models/LmsEngagement');

// Convert empty-string date values to null so MySQL doesn't reject them
function sanitizeDates(data) {
  const DATE_FIELDS = ['graduationDate'];
  const ENR_DATE_FIELDS = ['gradDate', 'courseStartDate', 'courseStopDate'];
  const out = { ...data };
  for (const f of DATE_FIELDS) {
    if (out[f] === '' || out[f] === 'Invalid date') out[f] = null;
  }
  if (out.enrollment) {
    out.enrollment = { ...out.enrollment };
    for (const f of ENR_DATE_FIELDS) {
      if (out.enrollment[f] === '' || out.enrollment[f] === 'Invalid date') out.enrollment[f] = null;
    }
  }
  return out;
}

// GET /api/students
router.get('/', protect, async (req, res, next) => {
  try {
    const { search, archived, inactive, graduated } = req.query;
    const where = {};

    if (archived !== undefined) where.archived = archived === 'true';
    if (inactive !== undefined) where.inactive = inactive === 'true';
    if (graduated === 'false') where.graduationDate = null;
    else if (graduated === 'true') where.graduationDate = { [Op.ne]: null };
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { sisId:     { [Op.like]: `%${search}%` } },
      ];
    }

    const students = await Student.findAll({
      where,
      order: [['lastName', 'ASC'], ['firstName', 'ASC']],
    });
    res.json(students);
  } catch (err) {
    next(err);
  }
});

// GET /api/students/reports/inactive
router.get('/reports/inactive', protect, async (req, res, next) => {
  try {
    const students = await Student.findAll({
      where: { inactive: true, archived: false },
      order: [['lastName', 'ASC'], ['firstName', 'ASC']],
    });
    const studentIds = students.map((s) => s.id);

    const [interactions, engagements, progressRecords] = await Promise.all([
      Interaction.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        order: [['date', 'DESC']],
      }),
      LmsEngagement.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        order: [['lastActive', 'DESC']],
      }),
      CourseProgress.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        order: [['lastSyncedAt', 'DESC'], ['updatedAt', 'DESC']],
      }),
    ]);

    const lastInteractionByStudent = {};
    const contactCountByStudent = {};
    for (const item of interactions) {
      contactCountByStudent[item.studentId] = (contactCountByStudent[item.studentId] || 0) + 1;
      if (!lastInteractionByStudent[item.studentId]) lastInteractionByStudent[item.studentId] = item;
    }

    const lastEngagementByStudent = {};
    for (const item of engagements) {
      if (!lastEngagementByStudent[item.studentId]) lastEngagementByStudent[item.studentId] = item;
    }

    const lastProgressByStudent = {};
    for (const item of progressRecords) {
      if (!lastProgressByStudent[item.studentId]) lastProgressByStudent[item.studentId] = item;
    }

    const rows = students.map((student) => {
      const interaction = lastInteractionByStudent[student.id] || null;
      const engagement = lastEngagementByStudent[student.id] || null;
      const progress = lastProgressByStudent[student.id] || null;
      const lastCourse = student.enrollment?.currentCourse || progress?.courseName || '';
      const lastCourseEndDate = student.enrollment?.courseStopDate
        || student.enrollment?.gradDate
        || progress?.dueDate
        || null;

      return {
        studentId: student.id,
        sisId: student.sisId,
        studentName: student.fullName,
        program: student.enrollment?.program || '',
        lastCourse,
        lastCourseEndDate,
        inactiveSince: student.updatedAt || null,
        graduationDate: student.graduationDate || null,
        statusNote: student.statusNote || '',
        lastCanvasActivity: engagement?.lastActive || null,
        lastContactDate: interaction?.date || null,
        lastContactType: interaction?.type || '',
        lastContactBy: interaction?.instructorName || '',
        contactAttempts: contactCountByStudent[student.id] || 0,
      };
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/students
router.post('/', protect, requireWrite, async (req, res, next) => {
  try {
    const student = await Student.create(sanitizeDates(req.body));
    res.status(201).json(student);
  } catch (err) {
    next(err);
  }
});

// GET /api/students/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// GET /api/students/:id/summary
router.get('/:id/summary', protect, async (req, res, next) => {
  try {
    const [student, interactionCount, outcomeCount, progress] = await Promise.all([
      Student.findByPk(req.params.id),
      Interaction.count({ where: { studentId: req.params.id } }),
      Outcome.count({ where: { studentId: req.params.id } }),
      CourseProgress.findOne({
        where: { studentId: req.params.id },
        order: [['updatedAt', 'DESC']],
      }),
    ]);

    if (!student) return res.status(404).json({ message: 'Student not found' });

    const contactCount = (student.contacts || []).length;

    res.json({ student, interactionCount, outcomeCount, contactCount, progress: progress || null });
  } catch (err) {
    next(err);
  }
});

// PUT /api/students/:id
router.put('/:id', protect, requireWrite, async (req, res, next) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    await student.update(sanitizeDates(req.body));
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/students/:id
router.delete('/:id', protect, requireWrite, async (req, res, next) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    await student.destroy();
    res.json({ message: 'Student deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
