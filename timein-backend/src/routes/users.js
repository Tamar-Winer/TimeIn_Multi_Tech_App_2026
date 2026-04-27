
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,full_name,email,role,team,is_active FROM users ORDER BY full_name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  const { fullName, role, team, isActive } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET full_name=COALESCE($1,full_name),role=COALESCE($2,role),team=COALESCE($3,team),is_active=COALESCE($4,is_active),updated_at=NOW() WHERE id=$5 RETURNING id,full_name,email,role,team,is_active',
      [fullName, role, team, isActive, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
