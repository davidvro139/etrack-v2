/**
 * Create a default user
 * Usage: node scripts/create-user.js [email] [password] [name]
 * Defaults: admin@etrack.local / admin123 / Admin
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sequelize = require('../src/db');
const User = require('../src/models/User');

const email    = process.argv[2] || 'admin@etrack.local';
const password = process.argv[3] || 'admin123';
const name     = process.argv[4] || 'Admin';

async function run() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    console.log(`User already exists: ${email}`);
    await sequelize.close();
    return;
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: 'admin' });
  console.log(`✓ User created`);
  console.log(`  Email:    ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Name:     ${user.name}`);
  console.log(`  Role:     ${user.role}`);

  await sequelize.close();
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
