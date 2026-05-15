const router = require('express').Router();
const { protect } = require('../middleware/auth');
const CanvasService = require('../services/CanvasService');
const StudentReflection = require('../models/StudentReflection');
const Student = require('../models/Student');

function requireCanvas(req, res) {
  const { canvasToken, canvasSiteUrl, canvasCourseFilter } = req.user;
  if (!canvasToken || !canvasSiteUrl) {
    res.status(400).json({ message: 'Canvas token and site URL are required. Update them in Settings.' });
    return null;
  }
  return new CanvasService(canvasSiteUrl, canvasToken, canvasCourseFilter);
}

// GET /api/canvas/on-track — SSE stream: progress events then final rows
router.get('/on-track', protect, async (req, res) => {
  const { canvasToken, canvasSiteUrl } = req.user;
  if (!canvasToken || !canvasSiteUrl) {
    return res.status(400).json({ message: 'Canvas token and site URL are required. Update them in Settings.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function send(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const canvas = new CanvasService(canvasSiteUrl, canvasToken, req.user.canvasCourseFilter);
    const rows = await canvas.buildOnTrackReport(({ current, total, message }) => {
      send({ type: 'progress', current, total, message });
    });
    send({ type: 'done', rows });
  } catch (err) {
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

// POST /api/canvas/sync
router.post('/sync', protect, async (req, res, next) => {
  try {
    const canvas = requireCanvas(req, res);
    if (!canvas) return;
    const result = await canvas.syncToDatabase();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/canvas/reflections — pull ungraded reflections from Canvas
router.get('/reflections', protect, async (req, res, next) => {
  try {
    const canvas = requireCanvas(req, res);
    if (!canvas) return;
    const reflections = await canvas.getUngradedReflections();
    res.json(reflections);
  } catch (err) {
    next(err);
  }
});

// POST /api/canvas/grade — grade a submission and save locally
router.post('/grade', protect, async (req, res, next) => {
  try {
    const canvas = requireCanvas(req, res);
    if (!canvas) return;

    const { courseId, quizId, submissionId, attempt, questionIds, pass, comment, reflection } = req.body;

    if (!quizId) {
      return res.status(400).json({ message: 'This submission has no quiz ID — cannot grade via API.' });
    }

    const canvasResult = await canvas.gradeReflection(
      courseId, quizId, submissionId, attempt, questionIds, pass, comment
    );

    // Match to a local student by canvasUserId
    const allStudents = await Student.findAll();
    const student = allStudents.find(
      (s) => s.enrollment && String(s.enrollment.canvasUserId) === String(reflection.canvasUserId)
    );

    // Save/update the reflection record locally
    await StudentReflection.upsert({
      studentId: student?.id || null,
      canvasSubmissionId: submissionId,
      canvasCourseId: courseId,
      canvasUserId: reflection.canvasUserId,
      canvasStudentName: reflection.studentName,
      assignmentName: reflection.assignmentName,
      quizId,
      attempt,
      questions: reflection.questions,
      courseDeadline: reflection.answers?.courseDeadline || '',
      onTrack: reflection.answers?.onTrack || '',
      daysAttended: reflection.answers?.daysAttended || '',
      learned: reflection.answers?.learned || '',
      challenge: reflection.answers?.challenge || '',
      anyQuestions: reflection.answers?.anyQuestions || '',
      submittedAt: reflection.submittedAt ? new Date(reflection.submittedAt) : new Date(),
      graded: true,
      gradeComment: comment || '',
      score: pass ? (questionIds.length * 6) : 0,
    });

    res.json({ success: true, canvasResult });
  } catch (err) {
    next(err);
  }
});

// GET /api/canvas/reflections/history — locally saved graded reflections
router.get('/reflections/history', protect, async (req, res, next) => {
  try {
    const records = await StudentReflection.findAll({
      where: { graded: true },
      order: [['submittedAt', 'DESC']],
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
