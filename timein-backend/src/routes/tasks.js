
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  const { projectId, assignedUserId, status } = req.query;
  const conds = ['1=1'], params = [];
  if (projectId)      { params.push(projectId);      conds.push('t.project_id=$' + params.length); }
  if (assignedUserId) { params.push(assignedUserId);  conds.push('t.assigned_user_id=$' + params.length); }
  if (status)         { params.push(status);          conds.push('t.status=$' + params.length); }
  try {
    const { rows } = await pool.query(
      'SELECT t.*,p.project_name,u.full_name AS assigned_user_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assigned_user_id WHERE ' + conds.join(' AND ') + ' ORDER BY t.created_at DESC',
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('admin','manager'), async (req, res, next) => {
  const { taskName, description, projectId, assignedUserId, priority, clickupTaskId, estimatedHours, dueDate } = req.body;
  if (!taskName || !projectId) return res.status(400).json({ error: 'taskName and projectId required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO tasks (task_name,description,project_id,assigned_user_id,priority,clickup_task_id,estimated_hours,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [taskName, description, projectId, assignedUserId, priority||'medium', clickupTaskId, estimatedHours, dueDate]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('admin','manager'), async (req, res, next) => {
  const { taskName, status, assignedUserId, priority, estimatedHours } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE tasks SET task_name=COALESCE($1,task_name),status=COALESCE($2,status),assigned_user_id=COALESCE($3,assigned_user_id),priority=COALESCE($4,priority),estimated_hours=COALESCE($5,estimated_hours),updated_at=NOW() WHERE id=$6 RETURNING *',
      [taskName, status, assignedUserId, priority, estimatedHours, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
