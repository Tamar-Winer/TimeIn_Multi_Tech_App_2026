
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT p.*,u.full_name AS manager_name FROM projects p LEFT JOIN users u ON u.id=p.manager_id ORDER BY p.project_name'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  const { projectName, description, managerId, gitRepositoryName, gitRepositoryUrl, clickupSpaceId } = req.body;
  if (!projectName) return res.status(400).json({ error: 'projectName required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO projects (project_name,description,manager_id,git_repository_name,git_repository_url,clickup_space_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [projectName, description, managerId, gitRepositoryName, gitRepositoryUrl, clickupSpaceId]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('admin','manager'), async (req, res, next) => {
  const { projectName, description, status, managerId } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE projects SET project_name=COALESCE($1,project_name),description=COALESCE($2,description),status=COALESCE($3,status),manager_id=COALESCE($4,manager_id),updated_at=NOW() WHERE id=$5 RETURNING *',
      [projectName, description, status, managerId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
