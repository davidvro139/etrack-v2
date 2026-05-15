const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const CourseProgress = sequelize.define('CourseProgress', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  courseId: { type: DataTypes.STRING, allowNull: false },
  courseName: { type: DataTypes.STRING, defaultValue: '' },
  totalModules: { type: DataTypes.INTEGER, defaultValue: 0 },
  completedModules: { type: DataTypes.INTEGER, defaultValue: 0 },
  dueDate: { type: DataTypes.DATE },
  pace: {
    type: DataTypes.ENUM('FullTime', 'PartTime', 'HighSchool'),
    defaultValue: 'FullTime',
  },
  lastSyncedAt: { type: DataTypes.DATE },
  progressPercent: {
    type: DataTypes.VIRTUAL,
    get() {
      const total = this.totalModules;
      if (!total) return 0;
      return Math.round((this.completedModules / total) * 100);
    },
  },
});

module.exports = CourseProgress;
