const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../db');

const User = sequelize.define('User', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'instructor' },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  canvasToken: { type: DataTypes.TEXT, defaultValue: '' },
  canvasSiteUrl: { type: DataTypes.STRING, defaultValue: '' },
  canvasCourseFilter: { type: DataTypes.STRING, defaultValue: '' },
});

User.prototype.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

User.hashPassword = function (plain) {
  return bcrypt.hash(plain, 12);
};

module.exports = User;
