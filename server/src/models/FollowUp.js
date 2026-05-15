const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const FollowUp = sequelize.define('FollowUp', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  note: { type: DataTypes.TEXT, defaultValue: '' },
  dueDate: { type: DataTypes.DATE, allowNull: false },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  createdById: { type: DataTypes.INTEGER },
  createdByName: { type: DataTypes.STRING, defaultValue: '' },
});

module.exports = FollowUp;
