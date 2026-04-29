
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  const { userId, projectId, taskId, status, dateFrom, dateTo, clickupTaskId } = req.query;
  const conds = [], params = [];
  if (req.user.role === 'employee') { params.push(req.user.id); conds.push('te.user_id=$' + params.length); }
  else if (userId) { params.push(userId); conds.push('te.user_id=$' + params.length); }
  if (projectId)    { params.push(projectId);    conds.push('te.project_id=$' + params.length); }
  if (taskId)       { params.push(taskId);        conds.push('te.task_id=$' + params.length); }
  if (status)       { params.push(status);        conds.push('te.status=$' + params.length); }
  if (dateFrom)     { params.push(dateFrom);      conds.push('te.date>=$' + params.length); }
  if (dateTo)       { params.push(dateTo);        conds.push('te.date<=$' + params.length); }
  if (clickupTaskId){ params.push(clickupTaskId); conds.push('te.related_clickup_task_id=$' + params.length); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  try {
    const { rows } = await pool.query(
      `SELECT te.*, u.full_name AS user_name, p.project_name, t.task_name,
              ctl.task_name AS clickup_task_name
       FROM time_entries te
       LEFT JOIN users u               ON u.id   = te.user_id
       LEFT JOIN projects p            ON p.id   = te.project_id
       LEFT JOIN tasks t               ON t.id   = te.task_id
       LEFT JOIN clickup_task_links ctl ON ctl.clickup_task_id = te.related_clickup_task_id
       ${where}
       ORDER BY te.date DESC, te.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  const { projectId, taskId, date, startTime, endTime, durationMinutes, workType, description, source, relatedCommitIds, relatedClickupTaskId } = req.body;
  if (!projectId || !date) return res.status(400).json({ error: 'projectId and date required' });
  if (startTime && endTime) {
    const [sh,sm] = startTime.split(':').map(Number);
    const [eh,em] = endTime.split(':').map(Number);
    if (eh*60+em <= sh*60+sm) return res.status(400).json({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' });
  }
  // Retroactive policy check (employees only)
  if (req.user.role === 'employee') {
    try {
      const { rows: cfg } = await pool.query(
        "SELECT key, value FROM settings WHERE key IN ('retroactive_allowed','retroactive_max_days')"
      );
      const s = Object.fromEntries(cfg.map(r => [r.key, r.value]));
      if (s.retroactive_allowed === 'false') {
        const today = new Date(); today.setHours(0,0,0,0);
        const entryDate = new Date(date); entryDate.setHours(0,0,0,0);
        if (entryDate < today) return res.status(403).json({ error: 'דיווח רטרואקטיבי אינו מורשה במערכת' });
      } else if (s.retroactive_max_days) {
        const maxDays = parseInt(s.retroactive_max_days, 10);
        const cutoff  = new Date(); cutoff.setDate(cutoff.getDate() - maxDays); cutoff.setHours(0,0,0,0);
        const entryDate = new Date(date); entryDate.setHours(0,0,0,0);
        if (entryDate < cutoff) return res.status(403).json({ error: `לא ניתן לדווח על תאריך ישן מ-${maxDays} ימים` });
      }
    } catch (_) {}
  }
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
    const infoRes = await pool.query(
      'SELECT te.date, te.user_id, p.project_name FROM time_entries te LEFT JOIN projects p ON p.id=te.project_id WHERE te.id=$1',
      [req.params.id]
    );
    const { rows } = await pool.query(
      "UPDATE time_entries SET status='rejected',rejection_reason=$1,updated_at=NOW() WHERE id=$2 AND status='submitted' RETURNING *",
      [req.body.reason||null, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not submitted' });

    if (infoRes.rows.length) {
      const e = infoRes.rows[0];
      const reason = req.body.reason ? ` סיבה: ${req.body.reason}.` : '';
      const msg = `הדיווח שלך מתאריך ${e.date}${e.project_name ? ' לפרויקט ' + e.project_name : ''} נדחה.${reason} נא לתקן את ההגשה או לפנות למנהל.`;
      await pool.query(
        'INSERT INTO notifications (user_id, message, link) VALUES ($1,$2,$3)',
        [e.user_id, msg, '/my-entries']
      );
    }

    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  const { projectId, taskId, date, startTime, endTime, durationMinutes, workType, description, relatedCommitIds } = req.body;
  if (startTime && endTime) {
    const [sh,sm] = startTime.split(':').map(Number);
    const [eh,em] = endTime.split(':').map(Number);
    if (eh*60+em <= sh*60+sm) return res.status(400).json({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' });
  }
  let dur = durationMinutes;
  if (!dur && startTime && endTime) {
    const [sh,sm] = startTime.split(':').map(Number);
    const [eh,em] = endTime.split(':').map(Number);
    dur = (eh*60+em) - (sh*60+sm);
  }
  try {
    // שמור את הסטטוס הנוכחי לפני העדכון
    const prevRes = await pool.query(
      'SELECT status, user_id, project_id FROM time_entries WHERE id=$1', [req.params.id]
    );
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const wasRejected = prevRes.rows[0].status === 'rejected';
    const entryUserId = prevRes.rows[0].user_id;
    const entryProjectId = prevRes.rows[0].project_id;

    const { rows } = await pool.query(
      `UPDATE time_entries
       SET project_id=COALESCE($1,project_id),
           task_id=COALESCE($2,task_id),
           date=COALESCE($3,date),
           start_time=COALESCE($4,start_time),
           end_time=COALESCE($5,end_time),
           duration_minutes=COALESCE($6,duration_minutes),
           work_type=COALESCE($7,work_type),
           description=COALESCE($8,description),
           related_commit_ids=COALESCE($9,related_commit_ids),
           status=CASE WHEN status='rejected' THEN 'submitted' ELSE status END,
           updated_at=NOW()
       WHERE id=$10 AND user_id=$11 AND status IN ('draft','rejected') RETURNING *`,
      [projectId, taskId, date, startTime, endTime, dur, workType, description, relatedCommitIds, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not editable' });

    // שלח notification למנהלים כשעובד מתקן דיווח שנדחה
    if (wasRejected) {
      const mgrsRes = await pool.query(
        'SELECT id FROM users WHERE role IN (\'manager\',\'admin\') AND is_active=TRUE AND id!=$1',
        [entryUserId]
      );
      const projRes = await pool.query('SELECT project_name FROM projects WHERE id=$1', [entryProjectId]);
      const projName = projRes.rows[0]?.project_name || '';
      const entryDate = rows[0].date instanceof Date ? rows[0].date.toISOString().slice(0,10) : String(rows[0].date).slice(0,10);
      const msg = `עובד תיקן דיווח שנדחה — תאריך ${entryDate}${projName ? ', פרויקט ' + projName : ''}. הדיווח הוחזר לבדיקה נוספת.`;
      if (mgrsRes.rows.length) {
        const vals = mgrsRes.rows.map((_, i) => `($${i*3+1},$${i*3+2},$${i*3+3})`).join(',');
        const params = mgrsRes.rows.flatMap(u => [u.id, msg, '/management']);
        await pool.query(`INSERT INTO notifications (user_id,message,link) VALUES ${vals}`, params);
      }
    }

    res.json(rows[0]);
  } catch (err) {
    if (err.message.includes('overlap')) return res.status(409).json({ error: 'חפיפה בין דיווחים — שנה את שעות העבודה' });
    next(err);
  }
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
