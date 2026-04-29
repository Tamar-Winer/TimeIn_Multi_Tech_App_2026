
const router = require('express').Router();
const pool   = require('../config/db');
const crypto = require('crypto');
const { authenticate, requireRole } = require('../middleware/auth');

function generateKey() {
  const secret = crypto.randomBytes(32).toString('hex');
  const prefix = 'tk_' + secret.slice(0, 6);
  return { full: 'tk_' + secret, prefix };
}

// List all API keys (admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ak.id, ak.name, ak.key_prefix, ak.is_active, ak.last_used, ak.created_at,
              u.full_name AS owner_name
       FROM api_keys ak
       LEFT JOIN users u ON u.id = ak.user_id
       ORDER BY ak.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Create new API key
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, userId } = req.body;
    if (!name) return res.status(400).json({ error: 'שם נדרש' });
    const { full, prefix } = generateKey();
    const hash = crypto.createHash('sha256').update(full).digest('hex');
    const { rows } = await pool.query(
      `INSERT INTO api_keys (name, key_hash, key_prefix, user_id)
       VALUES ($1, $2, $3, $4) RETURNING id, name, key_prefix, created_at`,
      [name, hash, prefix, userId || null]
    );
    res.json({ ...rows[0], key: full });
  } catch (err) { next(err); }
});

// Toggle active status
router.patch('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    await pool.query('UPDATE api_keys SET is_active=$1 WHERE id=$2', [isActive, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Delete API key
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM api_keys WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Public API (external consumers) ─────────────────────────────────────────
async function validateApiKey(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) { res.status(401).json({ error: 'x-api-key header required' }); return null; }
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const { rows } = await pool.query(
    'SELECT * FROM api_keys WHERE key_hash=$1 AND is_active=TRUE', [hash]
  );
  if (!rows.length) { res.status(401).json({ error: 'Invalid or inactive API key' }); return null; }
  await pool.query('UPDATE api_keys SET last_used=NOW() WHERE id=$1', [rows[0].id]);
  return rows[0];
}

router.get('/public/time-entries', async (req, res, next) => {
  try {
    const key = await validateApiKey(req, res);
    if (!key) return;
    const { dateFrom, dateTo, userId, projectId, status } = req.query;
    const conds = [], vals = [];
    if (userId)    { conds.push(`te.user_id=$${vals.length+1}`);    vals.push(userId); }
    if (projectId) { conds.push(`te.project_id=$${vals.length+1}`); vals.push(projectId); }
    if (status)    { conds.push(`te.status=$${vals.length+1}`);     vals.push(status); }
    if (dateFrom)  { conds.push(`te.date>=$${vals.length+1}`);      vals.push(dateFrom); }
    if (dateTo)    { conds.push(`te.date<=$${vals.length+1}`);      vals.push(dateTo); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT te.id, te.date, u.full_name AS user_name, p.project_name,
              t.task_name, te.duration_minutes, te.status, te.description
       FROM time_entries te
       JOIN users u    ON u.id = te.user_id
       JOIN projects p ON p.id = te.project_id
       LEFT JOIN tasks t ON t.id = te.task_id
       ${where}
       ORDER BY te.date DESC LIMIT 1000`,
      vals
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.get('/public/users', async (req, res, next) => {
  try {
    const key = await validateApiKey(req, res);
    if (!key) return;
    const { rows } = await pool.query(
      `SELECT id, full_name, email, team, role, is_active FROM users WHERE is_active=TRUE ORDER BY full_name`
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.get('/public/projects', async (req, res, next) => {
  try {
    const key = await validateApiKey(req, res);
    if (!key) return;
    const { rows } = await pool.query(
      `SELECT id, project_name, description, status FROM projects ORDER BY project_name`
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) { next(err); }
});

module.exports = router;
