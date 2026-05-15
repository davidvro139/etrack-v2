const router = require('express').Router();
const { protect } = require('../middleware/auth');
const Student = require('../models/Student');
const HexPosition = require('../models/HexPosition');
const StudentGameStyle = require('../models/StudentGameStyle');

function normalizeCourseKey(name) {
  if (!name || !name.trim()) return '__UNASSIGNED__';
  let n = name.trim();
  n = n.replace(/^[A-Z]{2,}\s+\d+\s*/i, '');
  n = n.replace(/\([^)]+\)/g, '');
  n = n.replace(/-?\s*(extension|ext\.?)/gi, '');
  n = n.replace(/\s+/g, ' ').trim();
  return n.toUpperCase() || '__UNASSIGNED__';
}

// Compound position key scoped to a program+year board
function boardPositionKey(program, catalogYear, courseKey) {
  return `${program || ''}::${catalogYear || ''}::${courseKey}`;
}

const COL_W = 100, ROW_H = 108, ODD_OFFSET = 54, COLS = 5, START_X = 90, START_Y = 90;
function autoPosition(index) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { x: START_X + col * COL_W, y: START_Y + row * ROW_H + (col % 2 === 1 ? ODD_OFFSET : 0) };
}

// GET /api/gameboard/programs — distinct programs from active student enrollments
router.get('/programs', protect, async (req, res, next) => {
  try {
    const students = await Student.findAll({ where: { archived: false } });
    const programs = [...new Set(
      students.map((s) => s.enrollment?.program).filter(Boolean).map(String)
    )].sort();
    res.json(programs);
  } catch (err) { next(err); }
});

// GET /api/gameboard/catalog-years?program=X — distinct catalog years for a program
router.get('/catalog-years', protect, async (req, res, next) => {
  try {
    const { program } = req.query;
    const students = await Student.findAll({ where: { archived: false } });
    const years = [...new Set(
      students
        .filter((s) => !program || s.enrollment?.program === program)
        .map((s) => s.enrollment?.catalogYear)
        .filter(Boolean)
        .map(String)
    )].sort((a, b) => b.localeCompare(a)); // newest first
    res.json(years);
  } catch (err) { next(err); }
});

// GET /api/gameboard?program=X&catalogYear=Y
router.get('/', protect, async (req, res, next) => {
  try {
    const { program, catalogYear } = req.query;

    const allStudents = await Student.findAll({ where: { archived: false, inactive: false } });

    const students = allStudents.filter((s) => {
      if (program && s.enrollment?.program !== program) return false;
      if (catalogYear && String(s.enrollment?.catalogYear) !== String(catalogYear)) return false;
      return true;
    });

    const styles = await StudentGameStyle.findAll();
    const styleMap = Object.fromEntries(styles.map((s) => [s.studentId, s]));

    const courseMap = new Map();
    for (const student of students) {
      const courseName = student.enrollment?.currentCourse || '';
      const key = normalizeCourseKey(courseName);
      const displayName = key === '__UNASSIGNED__' ? 'Unassigned' : (courseName.trim() || 'Unassigned');

      if (!courseMap.has(key)) {
        courseMap.set(key, { courseKey: key, courseName: displayName, students: [] });
      }
      const existing = courseMap.get(key);
      if (courseName.length > existing.courseName.length && key !== '__UNASSIGNED__') {
        existing.courseName = courseName.trim();
      }
      const style = styleMap[student.id];
      existing.students.push({
        id: student.id, sisId: student.sisId,
        firstName: student.firstName, lastName: student.lastName,
        isSoftDropped: style?.isSoftDropped || false,
        indicatorColor: style?.indicatorColor || '#0078CC',
      });
    }

    const sortedKeys = [...courseMap.keys()].sort((a, b) => {
      if (a === '__UNASSIGNED__') return -1;
      if (b === '__UNASSIGNED__') return 1;
      return a.localeCompare(b);
    });

    // Load saved hex positions (scoped to this program+year board)
    const savedPositions = await HexPosition.findAll();
    const posMap = Object.fromEntries(
      savedPositions.map((p) => [p.courseKey, { x: p.x, y: p.y }])
    );

    const courses = sortedKeys.map((key, index) => {
      const course = courseMap.get(key);
      const boardKey = boardPositionKey(program, catalogYear, key);
      const pos = posMap[boardKey] || posMap[key] || autoPosition(index);
      return { ...course, boardKey, x: pos.x, y: pos.y };
    });

    res.json({ courses, program: program || null, catalogYear: catalogYear || null });
  } catch (err) { next(err); }
});

// PUT /api/gameboard/hex-position
router.put('/hex-position', protect, async (req, res, next) => {
  try {
    const { courseKey, x, y } = req.body;
    if (!courseKey) return res.status(400).json({ message: 'courseKey required' });
    await HexPosition.upsert({ courseKey, x, y });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PUT /api/gameboard/student/style
router.put('/student/style', protect, async (req, res, next) => {
  try {
    const { studentId, isSoftDropped, indicatorColor } = req.body;
    await StudentGameStyle.upsert({ studentId, isSoftDropped, indicatorColor: indicatorColor || '#0078CC' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PUT /api/gameboard/student/move
router.put('/student/move', protect, async (req, res, next) => {
  try {
    const { studentId, courseName } = req.body;
    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    await student.update({ enrollment: { ...(student.enrollment || {}), currentCourse: courseName } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
