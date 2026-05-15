const { requireAdmin, requireWrite } = require('../../middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAdmin middleware', () => {
  test('calls next() for admin users', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 403 for instructor', () => {
    const req = { user: { role: 'instructor' } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for observer', () => {
    const req = { user: { role: 'observer' } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireWrite middleware', () => {
  test('calls next() for admin', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    requireWrite(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('calls next() for instructor', () => {
    const req = { user: { role: 'instructor' } };
    const res = mockRes();
    const next = jest.fn();
    requireWrite(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 for observer', () => {
    const req = { user: { role: 'observer' } };
    const res = mockRes();
    const next = jest.fn();
    requireWrite(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
