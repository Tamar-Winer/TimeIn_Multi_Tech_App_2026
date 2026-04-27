
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  const { userId, projectId, taskId, status, dateFrom, dateTo } = req.query;
  const conds = [], params = [];
  if (req.user.role === 'employee') { params.push(req.user.id); conds.push('te.user_id=$' + params.length); }
  else if (userId) { params.push(userId); conds.push('te.user_id=$' + params.length); }
  if (projectId) { params.push(projectId); conds.push('te.project_id=$' + params.length); }
  if (taskId)    { params.push(taskId);    conds.push('te.task_id=$' + params.length); }
  if (status)    { params.push(status);    conds.push('te.status=$' + params.length); }
  if (dateFrom)  { params.push(dateFrom);  conds.push('te.date>=$' + params.length); }
  if (dateTo)    { params.push(dateTo);    conds.push('te.date<=$' + params.length); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  try {
    const { rows } = await pool.query(
      'SELECT te.*,u.full_name AS user_name,p.project_name,t.task_name FROM time_entries te LEFT JOIN users u ON u.id=te.user_id LEFT JOIN projects p ON p.id=te.project_id LEFT JOIN tasks t ON t.id=te.task_id ' + where + ' ORDER BY te.date DESC,te.created_at DESC',
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  const { projectId, taskId, date, startTime, endTime, durationMinutes, workType, description, source, relatedCommitIds, relatedClickupTaskId } = req.body;
  if (!projectId || !date) return res.status(400).json({ error: 'projectId and date required' });
  let dur = durationMinutes;
  if (!dur && startTime && endTime) {
    const [sh,sm] = startTime.split(':').map(Number);
    const [eh,em] = endTime.split(':').map(Number);
    dur = (eh*60+em) - (sh*60+sm);
  }
  if (!dur || dur <= 0) return res.status(400).json({ error: 'Duration must be positive' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO time_entries (user_id,project_id,task_id,date,start_time,end_time,duration_minutes,work_type,description,source,related_commit_ids,related_clickup_task_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [req.user.id, projectId, taskId||null, date, startTime||null, endTime||null, dur, workType||'development', description, source||'manual', relatedCommitIds||[], relatedClickupTaskId||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.message.includes('overlap')) return res.status(409).json({ error: 'Time overlap detected' });
    next(err);
  }
});

router.patch('/:id/submit', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE time_entries SET status='submitted',updated_at=NOW() WHERE id=$1 AND user_id=$2 AND status='draft' RETURNING *",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id/approve', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE time_entries SET status='approved',approved_by=$1,approved_at=NOW(),updated_at=NOW() WHERE id=$2 AND status='submitted' RETURNING *",
      [req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not submitted' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id/reject', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE time_entries SET status='rejected',rejection_reason=$1,updated_at=NOW() WHERE id=$2 AND status='submitted' RETURNING *",
      [req.body.reason||null, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not submitted' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  const { projectId, taskId, date, startTime, endTime, durationMinutes, workType, description, relatedCommitIds } = req.body;
  let dur = durationMinutes;
  if (!dur && startTime && endTime) {
    const [sh,sm] = startTime.split(':').map(Number);
    const [eh,em] = endTime.split(':').map(Number);
    dur = (eh*60+em) - (sh*60+sm);
  }
  try {
    const { rows } = await pool.query(
      'UPDATE time_entries SET project_id=COALESCE($1,project_id),task_id=COALESCE($2,task_id),date=COALESCE($3,date),start_time=COALESCE($4,start_time),end_time=COALESCE($5,end_time),duration_minutes=COALESCE($6,duration_minutes),work_type=COALESCE($7,work_type),description=COALESCE($8,description),related_commit_ids=COALESCE($9,related_commit_ids),updated_at=NOW() WHERE id=$10 RETURNING *',
      [projectId, taskId, date, startTime, endTime, dur, workType, description, relatedCommitIds, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM time_entries WHERE id=$1 AND user_id=$2 AND status='draft' RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not deletable' });
    res.json({ deleted: rows[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
