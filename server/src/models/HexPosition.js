const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const HexPosition = sequelize.define('HexPosition', {
  courseKey: { type: DataTypes.STRING(500), allowNull: false, unique: true },
  x: { type: DataTypes.FLOAT, allowNull: false },
  y: { type: DataTypes.FLOAT, allowNull: false },
});

module.exports = HexPosition;
