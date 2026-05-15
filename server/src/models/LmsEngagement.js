const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LmsEngagement = sequelize.define('LmsEngagement', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  courseId: { type: DataTypes.STRING, allowNull: false },
  pageViews: { type: DataTypes.INTEGER, defaultValue: 0 },
  participations: { type: DataTypes.INTEGER, defaultValue: 0 },
  estimatedHours: { type: DataTypes.FLOAT, defaultValue: 0 },
  lastActive: { type: DataTypes.DATE },
  lastSyncedAt: { type: DataTypes.DATE },
});

module.exports = LmsEngagement;
