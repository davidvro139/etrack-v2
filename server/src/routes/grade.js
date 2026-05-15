const router = require('express').Router();
const { protect } = require('../middleware/auth');
const CanvasService = require('../services/CanvasService');
const StudentReflection = require('../models/StudentReflection');
const Student = require('../models/Student');

// POST /api/grade/reflection
router.post('/reflection', protect, async (req, res, next) => {
try {
    const { canvasToken, canvasSiteUrl } = req.user;
    if (!canvasToken || !canvasSiteUrl)
      return res.status(400).json({ message: 'Canvas token and site URL required. Set them in Settings.' });

    const { courseId, quizId, submissionId, attempt, questionIds, pass, comment, reflection } = req.body;

    if (!quizId)
      return res.status(400).json({ message: 'No quiz ID — cannot grade via API. Use Speed Grader instead.' });

    const canvas = new CanvasService(canvasSiteUrl, canvasToken, req.user.canvasCourseFilter);
    let canvasResult;
    try {
      canvasResult = await canvas.gradeReflection(
        courseId, quizId, submissionId, attempt, questionIds, pass, comment
      );
    } catch (canvasErr) {
      const status = canvasErr.response?.status;
      if (status === 404) {
        return res.status(400).json({ message: 'Canvas could not find this quiz submission. It may have already been graded or the quiz ID is wrong. Use Speed Grader instead.' });
      }
      return res.status(400).json({ message: `Canvas API error (${status ?? 'unknown'}): ${canvasErr.message}` });
    }

    const allStudents = await Student.findAll();
    const student = allStudents.find(
      (s) => s.enrollment && String(s.enrollment.canvasUserId) === String(reflection.canvasUserId)
    );

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

module.exports = router;
