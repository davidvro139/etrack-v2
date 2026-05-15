const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.argv[2];
if (!dbPath) { console.error('Usage: node inspect-db.js <path.db>'); process.exit(1); }

const db = new DatabaseSync(path.resolve(dbPath), { readOnly: true });

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
console.log('\n=== TABLES ===');
tables.forEach(t => {
  const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
  console.log(`\n${t.name} (${cols.length} cols): ${cols.map(c => c.name).join(', ')}`);
  const rows = db.prepare(`SELECT * FROM ${t.name} LIMIT 2`).all();
  if (rows.length) console.log('  Sample:', JSON.stringify(rows[0], null, 2).split('\n').slice(0,20).join('\n'));
});
db.close();
