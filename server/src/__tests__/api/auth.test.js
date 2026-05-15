const request = require('supertest');
const app = require('../testApp');
const { clearDatabase } = require('../helpers');

beforeEach(clearDatabase);

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const User = require('../../models/User');
    const hash = await User.hashPassword('secret123');
    await User.create({ name: 'Alice', email: 'alice@test.com', passwordHash: hash, role: 'instructor' });
  });

  test('returns token and user on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@test.com');
    expect(res.body.user.role).toBe('instructor');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'secret123' });

    expect(res.status).toBe(401);
  });

  test('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/register', () => {
  test('first registration succeeds and creates admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'First User', email: 'first@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.token).toBeDefined();
  });

  test('second registration without admin token returns 401', async () => {
    // Create first user
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin', email: 'admin@test.com', password: 'password123' });

    // Try to register without a token
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Second', email: 'second@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  test('admin can create a second user with a specified role', async () => {
    // Create first (admin) user
    const firstRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin', email: 'admin@test.com', password: 'password123' });
    const adminToken = firstRes.body.token;

    // Admin creates observer
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Observer', email: 'observer@test.com', password: 'password123', role: 'observer' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('observer');
  });

  test('non-admin token cannot register new users', async () => {
    // Create admin
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin', email: 'admin@test.com', password: 'password123' });

    // Admin creates instructor
    await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminRes.body.token}`)
      .send({ name: 'Instructor', email: 'instructor@test.com', password: 'password123', role: 'instructor' });

    // Instructor tries to create another user
    const instrRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'instructor@test.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${instrRes.body.token}`)
      .send({ name: 'Another', email: 'another@test.com', password: 'password123' });

    expect(res.status).toBe(403);
  });
});
