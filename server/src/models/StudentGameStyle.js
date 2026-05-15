const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentGameStyle = sequelize.define('StudentGameStyle', {
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  studentId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  isSoftDropped: { type: DataTypes.BOOLEAN, defaultValue: false },
  indicatorColor: { type: DataTypes.STRING, defaultValue: '#0078CC' },
});

module.exports = StudentGameStyle;
