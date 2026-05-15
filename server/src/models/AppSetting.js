const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AppSetting = sequelize.define('AppSetting', {
  key: { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.TEXT },
}, { timestamps: false });

AppSetting.getSetting = async (key) => {
  const row = await AppSetting.findOne({ where: { key } });
  return row?.value ?? null;
};

AppSetting.setSetting = async (key, value) => {
  await AppSetting.upsert({ key, value: String(value) });
};

module.exports = AppSetting;
