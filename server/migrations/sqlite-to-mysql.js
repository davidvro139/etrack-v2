/**
 * SQLite → MySQL migration
 * Usage: node migrations/sqlite-to-mysql.js <path-to-etrack.db>
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const sequelize = require('../src/db');

const Student = require('../src/models/Student');
const Interaction = require('../src/models/Interaction');
const Outcome = require('../src/models/Outcome');
const CourseProgress = require('../src/models/CourseProgress');
const LmsEngagement = require('../src/models/LmsEngagement');
const StudentReflection = require('../src/models/StudentReflection');

const PACE_MAP = { 1: 'FullTime', 2: 'PartTime', 5: 'HighSchool' };

async function run() {
  const dbPath = process.argv[2];
  if (!dbPath) {
    console.error('Usage: node migrations/sqlite-to-mysql.js <path-to-etrack.db>');
    process.exit(1);
  }

  console.log(`Opening SQLite: ${path.resolve(dbPath)}`);
  const db = new DatabaseSync(path.resolve(dbPath), { readOnly: true });

  console.log(`Connecting to MySQL: ${process.env.DB_HOST}/${process.env.DB_NAME}`);
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log('Connected.\n');

  // --- Students ---
  const sqlStudents = db.prepare('SELECT * FROM Students').all();
  const enrollments = db.prepare('SELECT * FROM Enrollment').all();
  const enrollMap = Object.fromEntries(enrollments.map((e) => [e.StudentId, e]));

  // keyed by original SIS StudentId → MySQL auto-increment id
  const studentIdMap = {};
  let studentCount = 0;

  for (const s of sqlStudents) {
    const enr = enrollMap[s.StudentId] || {};
    const pace = PACE_MAP[enr.Pace] || 'FullTime';

    const [student] = await Student.findOrCreate({
      where: { sisId: String(s.StudentId) },
      defaults: {
        sisId: String(s.StudentId),
        firstName: s.FirstName || '',
        lastName: s.LastName || '',
        archived: s.Archived === 1,
        inactive: s.Inactive === 1,
        statusNote: s.StatusNote || '',
        graduationDate: s.Graduation && s.Graduation !== 0 ? new Date(s.Graduation) : null,
        enrollment: {
          program: enr.Program || '',
          catalogYear: enr.CatalogYear || '',
          currentCourse: enr.CurrentCourse || '',
          objective: enr.EnrollmentObjective || '',
          gradDate: enr.GradDate ? new Date(enr.GradDate) : null,
          courseStartDate: enr.CourseStartDate ? new Date(enr.CourseStartDate) : null,
          courseStopDate: enr.CourseStopDate ? new Date(enr.CourseStopDate) : null,
          pace,
        },
      },
    });

    studentIdMap[s.StudentId] = student.id;
    studentCount++;
  }
  console.log(`✓ Students: ${studentCount}`);

  // --- Fill currentCourse from CourseProgress where enrollment.currentCourse is empty ---
  let courseFilledCount = 0;
  try {
    const sqlProgress = db.prepare(
      `SELECT cp.*, e.Pace FROM CourseProgress cp
       LEFT JOIN Enrollment e ON e.StudentId = cp.StudentId
       ORDER BY cp.LastModified DESC`
    ).all();

    // Build map: sisId → most recent course name
    const latestCourse = {};
    for (const p of sqlProgress) {
      const sid = String(p.StudentId);
      if (!latestCourse[sid] && p.CourseName) latestCourse[sid] = p.CourseName;
    }

    for (const [sisId, courseName] of Object.entries(latestCourse)) {
      const student = await Student.findOne({ where: { sisId } });
      if (!student) continue;
      const enr = student.enrollment || {};
      if (!enr.currentCourse && courseName) {
        await student.update({ enrollment: { ...enr, currentCourse: courseName } });
        courseFilledCount++;
      }
    }
  } catch (e) {
    console.warn('  Could not fill currentCourse from progress:', e.message);
  }
  if (courseFilledCount) console.log(`  → filled currentCourse for ${courseFilledCount} students from CourseProgress`);

  // --- Interactions ---
  let interactionCount = 0;
  let interactionErrors = 0;
  try {
    // Clear existing so re-runs don't duplicate
    await Interaction.destroy({ where: {} });
    const sqlInteractions = db.prepare('SELECT * FROM StudentInteractions').all();

    for (const i of sqlInteractions) {
      const studentId = studentIdMap[i.StudentId];
      if (!studentId) continue;
      try {
        await Interaction.create({
          studentId,
          type: i.InteractionType || 'Other',
          notes: i.Notes || '',
          instructorName: i.InstructorName || '',
          date: i.Date ? new Date(i.Date) : new Date(),
        });
        interactionCount++;
      } catch (e) {
        interactionErrors++;
      }
    }
  } catch (e) {
    console.warn('  Interactions error:', e.message);
  }
  console.log(`✓ Interactions: ${interactionCount}${interactionErrors ? ` (${interactionErrors} skipped)` : ''}`);

  // --- Outcomes ---
  let outcomeCount = 0;
  try {
    await Outcome.destroy({ where: {} });
    const sqlOutcomes = db.prepare('SELECT * FROM Outcomes').all();
    for (const o of sqlOutcomes) {
      const studentId = studentIdMap[o.StudentId];
      if (!studentId) continue;
      await Outcome.create({
        studentId,
        employer: o.Employer || '',
        title: o.Title || '',
        status: o.Status || '',
        notes: o.Notes || '',
        date: o.Date ? new Date(o.Date) : new Date(),
      });
      outcomeCount++;
    }
  } catch (e) {
    console.warn('  Outcomes error:', e.message);
  }
  console.log(`✓ Outcomes: ${outcomeCount}`);

  // --- Course Progress ---
  let progressCount = 0;
  try {
    const sqlProgress = db.prepare('SELECT * FROM CourseProgress').all();
    for (const p of sqlProgress) {
      const studentId = studentIdMap[p.StudentId];
      if (!studentId) continue;
      await CourseProgress.upsert({
        studentId,
        courseId: String(p.CourseId),
        courseName: p.CourseName || '',
        totalModules: p.TotalModules || 0,
        completedModules: p.CompletedModules || 0,
        dueDate: p.DueDate ? new Date(p.DueDate) : null,
        pace: PACE_MAP[p.Pace] || 'FullTime',
        lastSyncedAt: p.LastModified ? new Date(p.LastModified) : new Date(),
      });
      progressCount++;
    }
  } catch (e) {
    console.warn('  CourseProgress error:', e.message);
  }
  console.log(`✓ Course Progress: ${progressCount}`);

  // --- LMS Engagement ---
  let engagementCount = 0;
  try {
    const sqlEng = db.prepare('SELECT * FROM LmsEngagement').all();
    for (const e of sqlEng) {
      const studentId = studentIdMap[e.StudentId];
      if (!studentId) continue;
      await LmsEngagement.upsert({
        studentId,
        courseId: String(e.CourseId || 'unknown'),
        pageViews: e.PageViews || 0,
        participations: e.Participations || 0,
        estimatedHours: e.EstimatedHours || 0,
        lastActive: e.LastActive ? new Date(e.LastActive) : null,
      });
      engagementCount++;
    }
  } catch (e) {
    console.warn('  LmsEngagement error:', e.message);
  }
  console.log(`✓ LMS Engagement: ${engagementCount}`);

  // --- Reflections ---
  let reflectionCount = 0;
  try {
    const sqlRef = db.prepare('SELECT * FROM StudentReflections').all();
    for (const r of sqlRef) {
      const studentId = studentIdMap[r.StudentId];
      if (!studentId) continue;
      await StudentReflection.create({
        studentId,
        onTrack: r.AreYouOnTrack === 1 ? 'Yes' : 'No',
        challenge: r.BiggestChallenge || '',
        learned: r.WhatDidYouLearn || '',
        submittedAt: r.Date ? new Date(r.Date) : new Date(),
      });
      reflectionCount++;
    }
  } catch (e) {
    console.warn('  StudentReflections error:', e.message);
  }
  console.log(`✓ Reflections: ${reflectionCount}`);

  db.close();
  await sequelize.close();
  console.log('\nMigration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
