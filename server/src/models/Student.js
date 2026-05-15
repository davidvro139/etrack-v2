const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Student = sequelize.define('Student', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  archived: { type: DataTypes.BOOLEAN, defaultValue: false },
  inactive: { type: DataTypes.BOOLEAN, defaultValue: false },
  statusNote: { type: DataTypes.TEXT, defaultValue: '' },
  graduationDate: { type: DataTypes.DATE },
  // Stored as JSON — mirrors original nested shape for API compatibility
  enrollment: {
    type: DataTypes.JSON,
    defaultValue: {},
    get() {
      const raw = this.getDataValue('enrollment');
      return raw || {};
    },
  },
  contacts: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      const raw = this.getDataValue('contacts');
      return raw || [];
    },
  },
  sisId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  fullName: {
    type: DataTypes.VIRTUAL,
    get() { return `${this.firstName} ${this.lastName}`; },
  },
});

module.exports = Student;
