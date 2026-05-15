const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Outcome = sequelize.define('Outcome', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  employer: { type: DataTypes.STRING, defaultValue: '' },
  title: { type: DataTypes.STRING, defaultValue: '' },
  status: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = Outcome;
