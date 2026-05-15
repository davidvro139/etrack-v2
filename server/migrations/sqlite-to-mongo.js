/**
 * SQLite → MongoDB migration
 * Usage: node migrations/sqlite-to-mongo.js <path-to-etrack.db>
 *
 * Reads from the ETrack 1.0 SQLite database and inserts into MongoDB.
 * Run once; safe to re-run (uses upsert where possible).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Database = require('better-sqlite3');
const path = require('path');

const Student = require('../src/models/Student');
const Interaction = require('../src/models/Interaction');
const Outcome = require('../src/models/Outcome');
const CourseProgress = require('../src/models/CourseProgress');
const LmsEngagement = require('../src/models/LmsEngagement');
const StudentReflection = require('../src/models/StudentReflection');

const PACE_MAP = { 1: 'FullTime', 2: 'PartTime', 5: 'HighSchool' };
const INTERACTION_MAP = {
  0: 'Counseling',
  1: 'Advising',
  2: 'Discipline',
  3: 'ProgressCheck',
  Counseling: 'Counseling',
  Advising: 'Advising',
  Discipline: 'Discipline',
  ProgressCheck: 'ProgressCheck',
};

async function run() {
  const dbPath = process.argv[2];
  if (!dbPath) {
    console.error('Usage: node migrations/sqlite-to-mongo.js <path-to-etrack.db>');
    process.exit(1);
  }

  console.log(`Opening SQLite: ${path.resolve(dbPath)}`);
  const db = new Database(path.resolve(dbPath), { readonly: true });

  console.log(`Connecting to MongoDB: ${process.env.MONGO_URI}`);
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  // --- Students ---
  const sqlStudents = db.prepare('SELECT * FROM Students').all();
  const enrollments = db.prepare('SELECT * FROM Enrollment').all();
  const enrollMap = Object.fromEntries(enrollments.map((e) => [e.StudentId, e]));

  const studentIdMap = {}; // SQLite int id → MongoDB ObjectId
  let studentCount = 0;

  for (const s of sqlStudents) {
    const enr = enrollMap[s.Id] || {};
    const pace = PACE_MAP[enr.Pace] || 'FullTime';

    const doc = await Student.findOneAndUpdate(
      { firstName: s.FirstName, lastName: s.LastName },
      {
        firstName: s.FirstName || '',
        lastName: s.LastName || '',
        archived: s.Archived === 1,
        inactive: s.Inactive === 1,
        statusNote: s.StatusNote || '',
        graduationDate: s.Graduation ? new Date(s.Graduation) : undefined,
        enrollment: {
          program: enr.Program || '',
          catalogYear: enr.CatalogYear || '',
          currentCourse: enr.CurrentCourse || '',
          gradDate: enr.GradDate ? new Date(enr.GradDate) : undefined,
          pace,
        },
      },
      { upsert: true, new: true }
    );
    studentIdMap[s.Id] = doc._id;
    studentCount++;
  }
  console.log(`✓ Students: ${studentCount}`);

  // --- Interactions ---
  let interactionCount = 0;
  try {
    const sqlInteractions = db.prepare('SELECT * FROM StudentInteractions').all();
    for (const i of sqlInteractions) {
      const mongoId = studentIdMap[i.StudentId];
      if (!mongoId) continue;
      const type = INTERACTION_MAP[i.InteractionType] || 'ProgressCheck';
      await Interaction.create({
        studentId: mongoId,
        type,
        notes: i.Notes || '',
        instructorName: i.InstructorName || '',
        date: i.Date ? new Date(i.Date) : new Date(),
      });
      interactionCount++;
    }
  } catch (e) {
    console.warn('  Interactions table not found or empty, skipping.');
  }
  console.log(`✓ Interactions: ${interactionCount}`);

  // --- Outcomes ---
  let outcomeCount = 0;
  try {
    const sqlOutcomes = db.prepare('SELECT * FROM Outcomes').all();
    for (const o of sqlOutcomes) {
      const mongoId = studentIdMap[o.StudentId];
      if (!mongoId) continue;
      await Outcome.create({
        studentId: mongoId,
        employer: o.Employer || '',
        title: o.Title || '',
        status: o.Status || 'Unknown',
        date: o.Date ? new Date(o.Date) : new Date(),
      });
      outcomeCount++;
    }
  } catch (e) {
    console.warn('  Outcomes table not found or empty, skipping.');
  }
  console.log(`✓ Outcomes: ${outcomeCount}`);

  // --- Course Progress ---
  let progressCount = 0;
  try {
    const sqlProgress = db.prepare('SELECT * FROM CourseProgress').all();
    for (const p of sqlProgress) {
      const mongoId = studentIdMap[p.StudentId];
      if (!mongoId) continue;
      await CourseProgress.findOneAndUpdate(
        { studentId: mongoId, courseId: String(p.CourseId) },
        {
          studentId: mongoId,
          courseId: String(p.CourseId),
          totalModules: p.TotalModules || 0,
          completedModules: p.CompletedModules || 0,
          dueDate: p.DueDate ? new Date(p.DueDate) : undefined,
          pace: PACE_MAP[p.Pace] || 'FullTime',
        },
        { upsert: true, new: true }
      );
      progressCount++;
    }
  } catch (e) {
    console.warn('  CourseProgress table not found or empty, skipping.');
  }
  console.log(`✓ Course Progress: ${progressCount}`);

  // --- LMS Engagement ---
  let engagementCount = 0;
  try {
    const sqlEng = db.prepare('SELECT * FROM LmsEngagement').all();
    for (const e of sqlEng) {
      const mongoId = studentIdMap[e.StudentId];
      if (!mongoId) continue;
      await LmsEngagement.findOneAndUpdate(
        { studentId: mongoId, courseId: String(e.CourseId || 'unknown') },
        {
          studentId: mongoId,
          courseId: String(e.CourseId || 'unknown'),
          pageViews: e.PageViews || 0,
          participations: e.Participations || 0,
          estimatedHours: e.EstimatedHours || 0,
          lastActive: e.LastActive ? new Date(e.LastActive) : undefined,
        },
        { upsert: true, new: true }
      );
      engagementCount++;
    }
  } catch (e) {
    console.warn('  LmsEngagement table not found or empty, skipping.');
  }
  console.log(`✓ LMS Engagement: ${engagementCount}`);

  // --- Reflections ---
  let reflectionCount = 0;
  try {
    const sqlRef = db.prepare('SELECT * FROM StudentReflections').all();
    for (const r of sqlRef) {
      const mongoId = studentIdMap[r.StudentId];
      if (!mongoId) continue;
      await StudentReflection.create({
        studentId: mongoId,
        courseDeadline: r.CourseDeadline ? new Date(r.CourseDeadline) : undefined,
        onTrack: r.AreYouOnTrack === 1,
        challenge: r.BiggestChallenge || '',
        learned: r.WhatDidYouLearn || '',
        submittedAt: r.Date ? new Date(r.Date) : new Date(),
      });
      reflectionCount++;
    }
  } catch (e) {
    console.warn('  StudentReflections table not found or empty, skipping.');
  }
  console.log(`✓ Reflections: ${reflectionCount}`);

  db.close();
  await mongoose.disconnect();
  console.log('\nMigration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
