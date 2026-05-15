const request = require('supertest');
const app = require('../testApp');
const { clearDatabase, createAdmin, createInstructor, createObserver, createStudent } = require('../helpers');

beforeEach(clearDatabase);

describe('GET /api/students', () => {
  test('returns students list for authenticated user', async () => {
    const { token } = await createInstructor();
    await createStudent({ firstName: 'Jordan', lastName: 'Mitchell' });
    await createStudent({ firstName: 'Aaliyah', lastName: 'Thompson' });

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/api/students');
    expect(res.status).toBe(401);
  });

  test('shows graduated students when no graduated param is sent (no filter applied)', async () => {
    const { token } = await createInstructor();
    await createStudent({ firstName: 'Active', sisId: 'S001' });
    const Student = require('../../models/Student');
    await Student.create({
      firstName: 'Graduated', lastName: 'Student', sisId: 'S002',
      graduationDate: new Date(), enrollment: {}, contacts: [],
    });

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.map((s) => s.firstName);
    // When no graduated param is sent, no graduation filter is applied
    expect(names).toContain('Active');
    expect(names).toContain('Graduated');
  });

  test('graduated=false excludes graduated students explicitly', async () => {
    const { token } = await createInstructor();
    await createStudent({ firstName: 'Active', sisId: 'S001' });
    const Student = require('../../models/Student');
    await Student.create({
      firstName: 'Graduated', lastName: 'Student', sisId: 'S002',
      graduationDate: new Date(), enrollment: {}, contacts: [],
    });

    const res = await request(app)
      .get('/api/students?graduated=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.map((s) => s.firstName)).not.toContain('Graduated');
  });

  test('graduated=true returns only graduated students', async () => {
    const { token } = await createInstructor();
    await createStudent({ firstName: 'Active', sisId: 'S001' });
    const Student = require('../../models/Student');
    await Student.create({
      firstName: 'Graduated', lastName: 'Student', sisId: 'S002',
      graduationDate: new Date(), enrollment: {}, contacts: [],
    });

    const res = await request(app)
      .get('/api/students?graduated=true')
      .set('Authorization', `Bearer ${token}`);

    const names = res.body.map((s) => s.firstName);
    expect(names).toContain('Graduated');
    expect(names).not.toContain('Active');
  });
});

describe('POST /api/students', () => {
  const newStudent = {
    firstName: 'New', lastName: 'Student', sisId: 'S999',
    enrollment: { program: 'IT Support' }, contacts: [],
  };

  test('instructor can create a student', async () => {
    const { token } = await createInstructor();
    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send(newStudent);

    expect(res.status).toBe(201);
    expect(res.body.firstName).toBe('New');
  });

  test('observer cannot create a student (403)', async () => {
    const { token } = await createObserver();
    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send(newStudent);

    expect(res.status).toBe(403);
  });

  test('admin can create a student', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send(newStudent);

    expect(res.status).toBe(201);
  });
});

describe('PUT /api/students/:id', () => {
  test('observer cannot update a student (403)', async () => {
    const { token: instrToken } = await createInstructor();
    const student = await createStudent();

    const { token: obsToken } = await createObserver();
    const res = await request(app)
      .put(`/api/students/${student.id}`)
      .set('Authorization', `Bearer ${obsToken}`)
      .send({ firstName: 'Hacked' });

    expect(res.status).toBe(403);
  });

  test('instructor can update a student', async () => {
    const { token } = await createInstructor();
    const student = await createStudent({ firstName: 'Original' });

    const res = await request(app)
      .put(`/api/students/${student.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Updated');
  });
});
