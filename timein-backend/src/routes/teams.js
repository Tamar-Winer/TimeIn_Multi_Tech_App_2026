
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET all teams — admin: all; manager: own team only
router.get('/', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const baseQuery = `
      SELECT t.id, t.name, t.project_id, t.manager_id, t.created_at, t.updated_at,
             p.project_name,
             u.full_name AS manager_name,
             COUNT(m.id) FILTER (WHERE m.id IS NOT NULL) AS member_count
      FROM teams t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u    ON u.id = t.manager_id
      LEFT JOIN users m    ON m.team_id = t.id
      %WHERE%
      GROUP BY t.id, p.project_name, u.full_name
      ORDER BY t.name
    `;
    let rows;
    if (req.user.role === 'admin') {
      ({ rows } = await pool.query(baseQuery.replace('%WHERE%', '')));
    } else {
      ({ rows } = await pool.query(
        baseQuery.replace('%WHERE%', 'WHERE t.manager_id = $1'),
        [req.user.id]
      ));
    }
    res.json(rows);
  } catch (err) { next(err); }
});

// GET members of a specific team
router.get('/:id/members', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    // Managers can only inspect their own team
    if (req.user.role === 'manager') {
      const { rows: teamRows } = await pool.query(
        'SELECT id FROM teams WHERE id = $1 AND manager_id = $2',
        [req.params.id, req.user.id]
      );
      if (!teamRows.length) return res.status(403).json({ error: 'אין גישה לצוות זה' });
    }
    const { rows } = await pool.query(
      'SELECT id, full_name, email, role, is_active FROM users WHERE team_id = $1 ORDER BY full_name',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST create team — admin only
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  const { name, projectId, managerId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'שם הצוות הוא שדה חובה' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO teams (name, project_id, manager_id) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), projectId || null, managerId || null]
    );
    const team = rows[0];
    // Assign the manager to this team so they are scoped to it
    if (managerId) {
      await pool.query('UPDATE users SET team_id = $1 WHERE id = $2', [team.id, managerId]);
    }
    res.status(201).json(team);
  } catch (err) { next(err); }
});

// PATCH update team — admin only
router.patch('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  const { name, projectId, managerId } = req.body;
  try {
    const oldRes = await pool.query('SELECT manager_id FROM teams WHERE id = $1', [req.params.id]);
    if (!oldRes.rows.length) return res.status(404).json({ error: 'צוות לא נמצא' });
    const oldManagerId = oldRes.rows[0].manager_id;

    const setClauses = ['updated_at=NOW()'];
    const params = [];
    if (name      !== undefined) { params.push(name.trim()); setClauses.push(`name=$${params.length}`); }
    if (projectId !== undefined) { params.push(projectId || null); setClauses.push(`project_id=$${params.length}`); }
    if (managerId !== undefined) { params.push(managerId || null); setClauses.push(`manager_id=$${params.length}`); }

    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE teams SET ${setClauses.join(',')} WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'צוות לא נמצא' });

    // Sync manager team_id assignments when manager changes
    if (managerId !== undefined) {
      if (oldManagerId && oldManagerId !== Number(managerId)) {
        await pool.query(
          'UPDATE users SET team_id = NULL WHERE id = $1 AND team_id = $2',
          [oldManagerId, req.params.id]
        );
      }
      if (managerId) {
        await pool.query('UPDATE users SET team_id = $1 WHERE id = $2', [req.params.id, managerId]);
      }
    }

    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE team — admin only
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await pool.query('UPDATE users SET team_id = NULL WHERE team_id = $1', [req.params.id]);
    const { rows } = await pool.query('DELETE FROM teams WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'צוות לא נמצא' });
    res.json({ deleted: rows[0].id });
  } catch (err) { next(err); }
});

// POST add a user to a team — admin only
router.post('/:id/members', authenticate, requireRole('admin'), async (req, res, next) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId הוא שדה חובה' });
  try {
    const { rows } = await pool.query(
      'UPDATE users SET team_id = $1 WHERE id = $2 RETURNING id, full_name, email, role, is_active, team_id',
      [req.params.id, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'משתמש לא נמצא' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE remove a user from a team — admin only
router.delete('/:id/members/:userId', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE users SET team_id = NULL WHERE id = $1 AND team_id = $2 RETURNING id',
      [req.params.userId, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'המשתמש אינו בצוות זה' });
    res.json({ removed: rows[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
