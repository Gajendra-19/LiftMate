const jwt = require('jsonwebtoken');

const getSecret = () => process.env.JWT_SECRET || 'liftmate-development-secret';

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    req.auth = jwt.verify(token, getSecret());
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.auth?.role !== role) return res.status(403).json({ message: 'Forbidden' });
  return next();
};

const requireOwnership = (paramName = 'userId') => (req, res, next) => {
  if (String(req.auth?.userId) !== String(req.params[paramName])) {
    return res.status(403).json({ message: 'You can only access your own data' });
  }
  return next();
};

module.exports = { requireAuth, requireRole, requireOwnership, getSecret };
