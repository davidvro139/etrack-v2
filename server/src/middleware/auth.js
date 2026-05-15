const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['passwordHash'] },
    });
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.active === false) return res.status(403).json({ message: 'Account deactivated' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
}

// Only admins
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

// Instructors and admins can write; observers cannot
function requireWrite(req, res, next) {
  if (req.user?.role === 'observer') {
    return res.status(403).json({ message: 'Observers cannot make changes' });
  }
  next();
}

module.exports = { protect, requireAdmin, requireWrite };
