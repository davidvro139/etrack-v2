const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Interaction = sequelize.define('Interaction', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Check-in',
  },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  instructorId: { type: DataTypes.INTEGER },
  instructorName: { type: DataTypes.STRING, defaultValue: '' },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = Interaction;
