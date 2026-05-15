const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, requireAdmin } = require('../middleware/auth');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function userPayload(user) {
  return {
    id: user.id,
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    canvasToken: user.canvasToken || '',
    canvasSiteUrl: user.canvasSiteUrl || '',
    canvasCourseFilter: user.canvasCourseFilter || '',
  };
}

// POST /api/auth/register — admin only (first user is bootstrapped; after that requires auth)
router.post('/register', async (req, res, next) => {
  try {
    const userCount = await User.count();
    if (userCount > 0) {
      // Not the first user — require admin token
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Only admins can create new accounts. Log in as an admin first.' });
      }
      const jwt2 = require('jsonwebtoken');
      let decoded;
      try { decoded = jwt2.verify(header.split(' ')[1], process.env.JWT_SECRET); }
      catch { return res.status(401).json({ message: 'Invalid token' }); }
      const requestingUser = await User.findByPk(decoded.id);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can create new accounts' });
      }
    }

    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'name, email, and password are required' });

    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await User.hashPassword(password);
    const isFirstUser = (await User.count()) === 0;
    const allowedRole = isFirstUser ? 'admin' : (['admin', 'instructor', 'observer'].includes(role) ? role : 'instructor');
    const user = await User.create({ name, email, passwordHash, role: allowedRole });
    res.status(201).json({ token: signToken(user.id), user: userPayload(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'email and password are required' });

    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    res.json({ token: signToken(user.id), user: userPayload(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
