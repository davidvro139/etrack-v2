const request = require('supertest');
const app = require('../testApp');
const { clearDatabase, createInstructor, createObserver, createStudent } = require('../helpers');

beforeEach(clearDatabase);

describe('POST /api/followups', () => {
  test('instructor can create a follow-up', async () => {
    const { token } = await createInstructor();
    const student = await createStudent();

    const res = await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-01', note: 'Check in about progress' });

    expect(res.status).toBe(201);
    expect(res.body.studentId).toBe(student.id);
    expect(res.body.note).toBe('Check in about progress');
    expect(res.body.completedAt == null).toBe(true);
  });

  test('observer cannot create a follow-up (403)', async () => {
    const { token } = await createObserver();
    const student = await createStudent();

    const res = await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-01' });

    expect(res.status).toBe(403);
  });

  test('returns 400 when dueDate is missing', async () => {
    const { token } = await createInstructor();
    const student = await createStudent();

    const res = await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/followups', () => {
  test('returns only pending follow-ups by default', async () => {
    const { token } = await createInstructor();
    const student = await createStudent();

    // Create two follow-ups
    const r1 = await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-01' });

    // Mark one complete
    await request(app)
      .put(`/api/followups/${r1.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true });

    await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-15' });

    const res = await request(app)
      .get('/api/followups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].completedAt).toBeNull();
  });

  test('includeCompleted=true returns all follow-ups', async () => {
    const { token } = await createInstructor();
    const student = await createStudent();

    const r1 = await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-01' });

    await request(app)
      .put(`/api/followups/${r1.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true });

    await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-15' });

    const res = await request(app)
      .get('/api/followups?includeCompleted=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body).toHaveLength(2);
  });

  test('includes studentName in response', async () => {
    const { token } = await createInstructor();
    const student = await createStudent({ firstName: 'Jordan', lastName: 'Mitchell' });

    await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-01' });

    const res = await request(app)
      .get('/api/followups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body[0].studentName).toBe('Jordan Mitchell');
  });
});

describe('PUT /api/followups/:id', () => {
  test('marking complete sets completedAt', async () => {
    const { token } = await createInstructor();
    const student = await createStudent();

    const created = await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-01' });

    const res = await request(app)
      .put(`/api/followups/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body.completedAt).not.toBeNull();
  });

  test('marking incomplete clears completedAt', async () => {
    const { token } = await createInstructor();
    const student = await createStudent();

    const created = await request(app)
      .post('/api/followups')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, dueDate: '2026-12-01' });

    await request(app)
      .put(`/api/followups/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true });

    const res = await request(app)
      .put(`/api/followups/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: false });

    expect(res.body.completedAt == null).toBe(true); // null or undefined both acceptable
  });
});
