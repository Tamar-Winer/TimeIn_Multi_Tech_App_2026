
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  const { fullName, email, password, role = 'employee', team, teamId } = req.body;
  if (!fullName || !email || !password) return res.status(400).json({ error: 'שם, מייל וסיסמה הם שדות חובה' });
  try {
    // Prevent two managers in the same team
    if (role === 'manager' && teamId) {
      const { rows: teamRows } = await pool.query(
        'SELECT name, manager_id FROM teams WHERE id = $1',
        [teamId]
      );
      if (!teamRows.length) return res.status(404).json({ error: 'הצוות שנבחר לא נמצא' });
      if (teamRows[0].manager_id) {
        return res.status(409).json({
          error: `לא ניתן להגדיר שני מנהלים לאותו צוות — לצוות "${teamRows[0].name}" כבר יש מנהל`
        });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const resolvedTeam = team || null;
    const { rows } = await pool.query(
      'INSERT INTO users (full_name,email,password_hash,role,team,team_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,full_name,email,role,team,team_id,is_active',
      [fullName, email, hash, role, resolvedTeam, teamId || null]
    );
    const newUser = rows[0];

    // If manager assigned to a team → set team's manager_id
    if (role === 'manager' && teamId) {
      await pool.query('UPDATE teams SET manager_id = $1, updated_at = NOW() WHERE id = $2', [newUser.id, teamId]);
    }

    res.status(201).json(newUser);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'כתובת המייל כבר קיימת במערכת' });
    next(err);
  }
});

router.get('/', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      ({ rows } = await pool.query(
        'SELECT id,full_name,email,role,team,team_id,is_active FROM users ORDER BY full_name'
      ));
    } else {
      // Managers see only users assigned to their team(s)
      const { rows: teamRows } = await pool.query(
        'SELECT id FROM teams WHERE manager_id = $1',
        [req.user.id]
      );
      if (teamRows.length) {
        const teamIds = teamRows.map(r => r.id);
        ({ rows } = await pool.query(
          'SELECT id,full_name,email,role,team,team_id,is_active FROM users WHERE team_id = ANY($1::int[]) ORDER BY full_name',
          [teamIds]
        ));
      } else {
        rows = [];
      }
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  const { fullName, role, team, isActive, teamId } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET full_name=COALESCE($1,full_name),
           role=COALESCE($2,role),
           team=COALESCE($3,team),
           is_active=COALESCE($4,is_active),
           team_id=CASE WHEN $5::int IS NOT NULL THEN $5::int ELSE team_id END,
           updated_at=NOW()
       WHERE id=$6
       RETURNING id,full_name,email,role,team,team_id,is_active`,
      [fullName, role, team, isActive, teamId ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
