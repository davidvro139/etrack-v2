const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentReflection = sequelize.define('StudentReflection', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  studentId: { type: DataTypes.INTEGER },
  // Quiz answers (mapped by position in submission_data)
  courseDeadline: { type: DataTypes.TEXT, defaultValue: '' },
  onTrack: { type: DataTypes.TEXT, defaultValue: '' },
  daysAttended: { type: DataTypes.TEXT, defaultValue: '' },
  learned: { type: DataTypes.TEXT, defaultValue: '' },
  challenge: { type: DataTypes.TEXT, defaultValue: '' },
  anyQuestions: { type: DataTypes.TEXT, defaultValue: '' },
  // Canvas metadata
  canvasSubmissionId: { type: DataTypes.STRING },
  canvasCourseId: { type: DataTypes.STRING },
  canvasUserId: { type: DataTypes.STRING },
  canvasStudentName: { type: DataTypes.STRING },
  assignmentName: { type: DataTypes.STRING, defaultValue: '' },
  quizId: { type: DataTypes.STRING },
  attempt: { type: DataTypes.INTEGER, defaultValue: 1 },
  questions: { type: DataTypes.JSON, defaultValue: [] },
  submittedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  // Grading
  graded: { type: DataTypes.BOOLEAN, defaultValue: false },
  gradeComment: { type: DataTypes.TEXT, defaultValue: '' },
  score: { type: DataTypes.FLOAT },
});

module.exports = StudentReflection;
