const router = require('express').Router();
const { protect, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');

// GET /api/users/me
router.get('/me', protect, (req, res) => {
  const { id, name, email, role, canvasToken, canvasSiteUrl, canvasCourseFilter } = req.user;
  res.json({ id, _id: id, name, email, role, canvasToken, canvasSiteUrl, canvasCourseFilter });
});

// PUT /api/users/me
router.put('/me', protect, async (req, res, next) => {
  try {
    const allowed = ['name', 'canvasToken', 'canvasSiteUrl', 'canvasCourseFilter'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await req.user.update(updates);
    const { id, name, email, role, canvasToken, canvasSiteUrl, canvasCourseFilter } = req.user;
    res.json({ id, _id: id, name, email, role, canvasToken, canvasSiteUrl, canvasCourseFilter });
  } catch (err) {
    next(err);
  }
});

// GET /api/users — admin: list all users
router.get('/', protect, requireAdmin, async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['passwordHash'] },
      order: [['name', 'ASC']],
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/users — admin: create user (delegates to shared logic)
router.post('/', protect, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'name, email, and password are required' });
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ message: 'Email already registered' });
    const passwordHash = await User.hashPassword(password);
    const allowedRole = ['admin', 'instructor', 'observer'].includes(role) ? role : 'instructor';
    const user = await User.create({ name, email, passwordHash, role: allowedRole });
    const { id, active } = user;
    res.status(201).json({ id, _id: id, name: user.name, email: user.email, role: user.role, active });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id — admin: update role or active status
router.put('/:id', protect, requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { role, active, name } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined && ['admin', 'instructor', 'observer'].includes(role)) updates.role = role;
    if (active !== undefined) updates.active = active;
    await user.update(updates);
    const { id } = user;
    res.json({ id, _id: id, name: user.name, email: user.email, role: user.role, active: user.active });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', protect, requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (String(user.id) === String(req.user.id))
      return res.status(400).json({ message: 'You cannot delete your own account' });
    await user.destroy();
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
