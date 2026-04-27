
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.get('/commits', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT gc.*,u.full_name FROM git_commits gc LEFT JOIN users u ON u.id=gc.linked_user_id ORDER BY gc.commit_date DESC LIMIT 100');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/commits', authenticate, async (req, res, next) => {
  const { repository, branch, commitHash, commitMessage, commitDate, linkedTaskId, linkedTimeEntryId } = req.body;
  if (!commitHash || !repository) return res.status(400).json({ error: 'commitHash and repository required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO git_commits (repository,branch,commit_hash,commit_message,commit_author_email,commit_date,linked_user_id,linked_task_id,linked_time_entry_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [repository, branch, commitHash, commitMessage, req.user.email, commitDate||new Date(), req.user.id, linkedTaskId||null, linkedTimeEntryId||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const [c, cu] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM git_commits'),
      pool.query('SELECT COUNT(*) FROM clickup_task_links')
    ]);
    res.json({ git: { status: 'connected', count: +c.rows[0].count }, clickup: { status: 'connected', count: +cu.rows[0].count } });
  } catch (err) { next(err); }
});

module.exports = router;
