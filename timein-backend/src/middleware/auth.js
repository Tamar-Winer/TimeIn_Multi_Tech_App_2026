
const jwt  = require('jsonwebtoken');
const pool = require('../config/db');
const authenticate = async (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const d = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id,full_name,email,role,team FROM users WHERE id=$1 AND is_active=TRUE', [d.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0]; next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
};
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
module.exports = { authenticate, requireRole };
