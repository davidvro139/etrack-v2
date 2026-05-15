const request = require('supertest');
const app = require('./testApp');
const User = require('../models/User');
const Student = require('../models/Student');

async function createUser(overrides = {}) {
  const defaults = {
    name: 'Test User',
    email: `user-${Date.now()}@test.com`,
    password: 'password123',
    role: 'instructor',
  };
  const data = { ...defaults, ...overrides };
  const passwordHash = await User.hashPassword(data.password);
  return User.create({ name: data.name, email: data.email, passwordHash, role: data.role, active: true });
}

async function loginAs(email, password = 'password123') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token;
}

async function createAdmin() {
  const user = await createUser({ email: 'admin@test.com', role: 'admin' });
  const token = await loginAs(user.email);
  return { user, token };
}

async function createInstructor() {
  const user = await createUser({ email: `instructor-${Date.now()}@test.com`, role: 'instructor' });
  const token = await loginAs(user.email);
  return { user, token };
}

async function createObserver() {
  const user = await createUser({ email: `observer-${Date.now()}@test.com`, role: 'observer' });
  const token = await loginAs(user.email);
  return { user, token };
}

async function createStudent(overrides = {}) {
  return Student.create({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'Student',
    sisId: overrides.sisId || `SIS-${Date.now()}`,
    enrollment: overrides.enrollment || { program: 'IT Support', currentCourse: 'A+ Core 1', pace: 'FullTime' },
    contacts: overrides.contacts || [],
  });
}

// Clear all data between tests (keeps schema intact)
async function clearDatabase() {
  const sequelize = require('../db');
  await sequelize.query('DELETE FROM FollowUps');
  await sequelize.query('DELETE FROM Interactions');
  await sequelize.query('DELETE FROM Outcomes');
  await sequelize.query('DELETE FROM CourseProgresses');
  await sequelize.query('DELETE FROM Students');
  await sequelize.query('DELETE FROM Users');
}

module.exports = { createUser, loginAs, createAdmin, createInstructor, createObserver, createStudent, clearDatabase };
