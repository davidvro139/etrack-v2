require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./db');

// Import all models so Sequelize registers them before sync
require('./models/User');
require('./models/Student');
require('./models/Interaction');
require('./models/Outcome');
require('./models/CourseProgress');
require('./models/LmsEngagement');
require('./models/StudentReflection');
require('./models/EmailTemplate');
require('./models/HexPosition');
require('./models/StudentGameStyle');
require('./models/AppSetting');
require('./models/FollowUp');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const interactionRoutes = require('./routes/interactions');
const outcomeRoutes = require('./routes/outcomes');
const progressRoutes = require('./routes/progress');
const canvasRoutes = require('./routes/canvas');
const gradeRoutes = require('./routes/grade');
const emailTemplateRoutes = require('./routes/emailTemplates');
const importRoutes = require('./routes/import');
const gameboardRoutes = require('./routes/gameboard');
const userRoutes = require('./routes/users');
const databaseRoutes = require('./routes/database');
const followupRoutes = require('./routes/followups');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/students', interactionRoutes);
app.use('/api/students', outcomeRoutes);
app.use('/api/students', progressRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/grade', gradeRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/import', importRoutes);
app.use('/api/gameboard', gameboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/followups', followupRoutes);

app.use(errorHandler);

// Sequelize alter:true adds a new unique index every restart (known bug).
// This drops the duplicates so the table doesn't hit MySQL's 64-key limit.
async function repairDuplicateIndexes() {
  const tables = [
    'Users', 'Students', 'Interactions', 'Outcomes', 'CourseProgresses',
    'LmsEngagements', 'StudentReflections', 'EmailTemplates',
    'HexPositions', 'StudentGameStyles', 'AppSettings',
  ];
  for (const table of tables) {
    try {
      const [rows] = await sequelize.query(
        `SELECT INDEX_NAME, COLUMN_NAME
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table
           AND NON_UNIQUE = 0
           AND INDEX_NAME != 'PRIMARY'
         ORDER BY INDEX_NAME`,
        { replacements: { table } }
      );
      // Group by column — keep the first index name, drop all others
      const seen = {};
      for (const { INDEX_NAME, COLUMN_NAME } of rows) {
        if (!seen[COLUMN_NAME]) { seen[COLUMN_NAME] = INDEX_NAME; continue; }
        try {
          await sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${INDEX_NAME}\``);
        } catch { /* already gone */ }
      }
    } catch { /* table may not exist yet */ }
  }
}

// Add any columns that exist in the model but not yet in the DB table.
// Safer than alter:true (which accumulates duplicate indexes).
async function addMissingColumns() {
  const { DataTypes, QueryTypes } = require('sequelize');
  const models = sequelize.models;

  for (const [modelName, model] of Object.entries(models)) {
    const tableName = model.getTableName();
    try {
      const existing = await sequelize.query(
        `SHOW COLUMNS FROM \`${tableName}\``,
        { type: QueryTypes.SELECT }
      );
      const existingNames = new Set(existing.map((c) => c.Field));

      for (const [attrName, attr] of Object.entries(model.rawAttributes)) {
        if (attr.type instanceof DataTypes.VIRTUAL) continue;
        const colName = attr.field || attrName;
        if (existingNames.has(colName)) continue;

        // Build a simple column definition
        let typeSql = 'VARCHAR(255)';
        const t = attr.type;
        if (t instanceof DataTypes.TEXT) typeSql = 'TEXT';
        else if (t instanceof DataTypes.BOOLEAN) typeSql = 'TINYINT(1)';
        else if (t instanceof DataTypes.INTEGER) typeSql = 'INT';
        else if (t instanceof DataTypes.FLOAT) typeSql = 'FLOAT';
        else if (t instanceof DataTypes.DATE) typeSql = 'DATETIME';
        else if (t instanceof DataTypes.JSON) typeSql = 'JSON';

        const nullable = attr.allowNull === false ? 'NOT NULL' : 'NULL';
        const def = attr.defaultValue !== undefined && attr.defaultValue !== null
          ? `DEFAULT ${sequelize.escape(String(attr.defaultValue))}`
          : '';

        await sequelize.query(
          `ALTER TABLE \`${tableName}\` ADD COLUMN \`${colName}\` ${typeSql} ${nullable} ${def}`
        );
        console.log(`  + Added column ${tableName}.${colName}`);
      }
    } catch { /* table may not exist yet — sync() will create it */ }
  }
}

async function start() {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected');
    await repairDuplicateIndexes();
    // sync() creates missing tables; addMissingColumns() handles new fields on existing tables.
    await sequelize.sync();
    await addMissingColumns();
    console.log('Tables synced');
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
