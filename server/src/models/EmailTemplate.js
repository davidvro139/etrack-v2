const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EmailTemplate = sequelize.define('EmailTemplate', {
  _id: {
    type: DataTypes.VIRTUAL,
    get() { return this.id; },
  },
  name: { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.TEXT, defaultValue: '' },
  body: { type: DataTypes.TEXT, defaultValue: '' },
});

module.exports = EmailTemplate;
