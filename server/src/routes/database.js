const router = require('express').Router();
const multer = require('multer');
const sequelize = require('../db');
const { protect } = require('../middleware/auth');

const CourseProgress = require('../models/CourseProgress');
const EmailTemplate = require('../models/EmailTemplate');
const HexPosition = require('../models/HexPosition');
const Interaction = require('../models/Interaction');
const LmsEngagement = require('../models/LmsEngagement');
const Outcome = require('../models/Outcome');
const Student = require('../models/Student');
const StudentGameStyle = require('../models/StudentGameStyle');
const StudentReflection = require('../models/StudentReflection');
const User = require('../models/User');
const FollowUp = require('../models/FollowUp');
const AppSetting = require('../models/AppSetting');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const BACKUP_VERSION = 1;
const MODELS = [
  AppSetting,
  User,
  Student,
  FollowUp,
  Interaction,
  Outcome,
  CourseProgress,
  LmsEngagement,
  StudentReflection,
  EmailTemplate,
  HexPosition,
  StudentGameStyle,
];

function tableName(model) {
  return model.getTableName();
}

// GET /api/database/backup
router.get('/backup', protect, async (req, res, next) => {
  try {
    const tables = {};

    for (const model of MODELS) {
      const name = tableName(model);
      const rows = await model.findAll({
        raw: true,
        order: [['id', 'ASC']],
      });
      tables[name] = rows;
    }

    const backup = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      database: process.env.DB_NAME || '',
      tables,
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="etrack-backup-${stamp}.json"`);
    res.json(backup);
  } catch (err) {
    next(err);
  }
});

// POST /api/database/restore
router.post('/restore', protect, upload.single('backup'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Backup file is required' });

    let backup;
    try {
      backup = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ message: 'Backup file is not valid JSON' });
    }

    if (!backup || backup.version !== BACKUP_VERSION || !backup.tables || typeof backup.tables !== 'object') {
      return res.status(400).json({ message: 'Backup file is not a recognized ETrack backup' });
    }

    const missing = MODELS.map(tableName).filter((name) => !Array.isArray(backup.tables[name]));
    if (missing.length) {
      return res.status(400).json({ message: `Backup is missing tables: ${missing.join(', ')}` });
    }

    const counts = {};
    await sequelize.transaction(async (transaction) => {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });

      for (const model of [...MODELS].reverse()) {
        await model.destroy({ where: {}, force: true, transaction });
      }

      for (const model of MODELS) {
        const name = tableName(model);
        const rows = backup.tables[name];
        if (rows.length) {
          await model.bulkCreate(rows, { validate: false, transaction });
        }
        counts[name] = rows.length;
      }

      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
    });

    res.json({ restored: true, counts });
  } catch (err) {
    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch {}
    next(err);
  }
});

module.exports = router;
