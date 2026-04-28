
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

function dateWhere(dateFrom, dateTo, col, startIdx = 1) {
  const conds = [], vals = [];
  if (dateFrom) { conds.push(`${col} >= $${startIdx + vals.length}`); vals.push(dateFrom); }
  if (dateTo)   { conds.push(`${col} <= $${startIdx + vals.length}`); vals.push(dateTo); }
  return { conds, vals };
}

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT SUM(CASE WHEN date=CURRENT_DATE THEN duration_minutes ELSE 0 END) AS today_minutes, SUM(CASE WHEN date>=date_trunc('week',NOW()) THEN duration_minutes ELSE 0 END) AS week_minutes, SUM(CASE WHEN date>=date_trunc('month',NOW()) THEN duration_minutes ELSE 0 END) AS month_minutes, COUNT(CASE WHEN status='draft' THEN 1 END) AS draft_count FROM time_entries WHERE user_id=$1",
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── לפי עובד ────────────────────────────────────────────────────────────────
router.get('/by-user', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const { conds, vals } = dateWhere(dateFrom, dateTo, 'te.date');
    const joinExtra = conds.length ? 'AND ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.team,
         COUNT(te.id)::int                                         AS entry_count,
         COALESCE(SUM(te.duration_minutes),0)::int                 AS total_minutes,
         ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2)        AS total_hours,
         COUNT(DISTINCT te.project_id)::int                        AS project_count,
         COUNT(DISTINCT te.task_id)::int                           AS task_count
       FROM users u
       LEFT JOIN time_entries te ON te.user_id = u.id ${joinExtra}
       WHERE u.is_active = TRUE
       GROUP BY u.id, u.full_name, u.team
       ORDER BY total_minutes DESC`,
      vals
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/by-user/:userId', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { dateFrom, dateTo } = req.query;
    const { conds, vals } = dateWhere(dateFrom, dateTo, 'te.date', 2);
    const extra = conds.length ? 'AND ' + conds.join(' AND ') : '';
    const allVals = [userId, ...vals];

    const [projects, tasks, daily] = await Promise.all([
      pool.query(
        `SELECT p.id, p.project_name,
           COALESCE(SUM(te.duration_minutes),0)::int          AS total_minutes,
           ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,
           COUNT(te.id)::int                                   AS entry_count
         FROM time_entries te JOIN projects p ON p.id = te.project_id
         WHERE te.user_id = $1 ${extra}
         GROUP BY p.id, p.project_name ORDER BY total_minutes DESC`,
        allVals
      ),
      pool.query(
        `SELECT t.id, t.task_name, p.project_name,
           COALESCE(SUM(te.duration_minutes),0)::int          AS total_minutes,
           ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,
           COUNT(te.id)::int                                   AS entry_count
         FROM time_entries te
         JOIN tasks t    ON t.id = te.task_id
         JOIN projects p ON p.id = te.project_id
         WHERE te.user_id = $1 ${extra}
         GROUP BY t.id, t.task_name, p.project_name ORDER BY total_minutes DESC`,
        allVals
      ),
      pool.query(
        `SELECT te.date,
           COALESCE(SUM(te.duration_minutes),0)::int          AS total_minutes,
           ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,
           COUNT(te.id)::int                                   AS entry_count
         FROM time_entries te
         WHERE te.user_id = $1 ${extra}
         GROUP BY te.date ORDER BY te.date DESC`,
        allVals
      ),
    ]);
    res.json({ projects: projects.rows, tasks: tasks.rows, daily: daily.rows });
  } catch (err) { next(err); }
});

// ── לפי פרויקט ──────────────────────────────────────────────────────────────
router.get('/by-project', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const { conds, vals } = dateWhere(dateFrom, dateTo, 'te.date');
    const joinExtra = conds.length ? 'AND ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT p.id, p.project_name,
         COUNT(te.id)::int                                         AS entry_count,
         COALESCE(SUM(te.duration_minutes),0)::int                 AS total_minutes,
         ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2)        AS total_hours,
         COUNT(DISTINCT te.user_id)::int                           AS user_count,
         COUNT(DISTINCT te.task_id)::int                           AS task_count
       FROM projects p
       LEFT JOIN time_entries te ON te.project_id = p.id ${joinExtra}
       GROUP BY p.id, p.project_name
       ORDER BY total_minutes DESC`,
      vals
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/by-project/:projectId', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { dateFrom, dateTo } = req.query;
    const { conds, vals } = dateWhere(dateFrom, dateTo, 'te.date', 2);
    const extra = conds.length ? 'AND ' + conds.join(' AND ') : '';
    const allVals = [projectId, ...vals];

    const [employees, tasks] = await Promise.all([
      pool.query(
        `SELECT u.id, u.full_name, u.team,
           COALESCE(SUM(te.duration_minutes),0)::int          AS total_minutes,
           ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,
           COUNT(te.id)::int                                   AS entry_count
         FROM time_entries te JOIN users u ON u.id = te.user_id
         WHERE te.project_id = $1 ${extra}
         GROUP BY u.id, u.full_name, u.team ORDER BY total_minutes DESC`,
        allVals
      ),
      pool.query(
        `SELECT COALESCE(t.task_name, 'ללא משימה') AS task_name,
           COALESCE(SUM(te.duration_minutes),0)::int          AS total_minutes,
           ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,
           COUNT(te.id)::int                                   AS entry_count
         FROM time_entries te
         LEFT JOIN tasks t ON t.id = te.task_id
         WHERE te.project_id = $1 ${extra}
         GROUP BY t.id, t.task_name ORDER BY total_minutes DESC`,
        allVals
      ),
    ]);
    res.json({ employees: employees.rows, tasks: tasks.rows });
  } catch (err) { next(err); }
});

// ── לפי משימה ───────────────────────────────────────────────────────────────
router.get('/by-task', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const { conds, vals } = dateWhere(dateFrom, dateTo, 'te.date');
    const joinExtra = conds.length ? 'AND ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT t.id, t.task_name, t.estimated_hours, p.project_name,
         COUNT(te.id)::int                                         AS entry_count,
         COALESCE(SUM(te.duration_minutes),0)::int                 AS total_minutes,
         ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2)        AS total_hours,
         COUNT(DISTINCT te.user_id)::int                           AS user_count,
         MAX(te.date)                                              AS last_activity
       FROM tasks t
       LEFT JOIN projects p        ON p.id = t.project_id
       LEFT JOIN time_entries te   ON te.task_id = t.id ${joinExtra}
       GROUP BY t.id, t.task_name, t.estimated_hours, p.project_name
       ORDER BY total_hours DESC NULLS LAST`,
      vals
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/by-task/:taskId', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { dateFrom, dateTo } = req.query;
    const { conds, vals } = dateWhere(dateFrom, dateTo, 'te.date', 2);
    const extra = conds.length ? 'AND ' + conds.join(' AND ') : '';
    const allVals = [taskId, ...vals];

    const [employees, dates] = await Promise.all([
      pool.query(
        `SELECT u.id, u.full_name,
           COALESCE(SUM(te.duration_minutes),0)::int          AS total_minutes,
           ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,
           COUNT(te.id)::int                                   AS entry_count
         FROM time_entries te JOIN users u ON u.id = te.user_id
         WHERE te.task_id = $1 ${extra}
         GROUP BY u.id, u.full_name ORDER BY total_minutes DESC`,
        allVals
      ),
      pool.query(
        `SELECT te.date, u.full_name, te.duration_minutes
         FROM time_entries te JOIN users u ON u.id = te.user_id
         WHERE te.task_id = $1 ${extra}
         ORDER BY te.date DESC LIMIT 50`,
        allVals
      ),
    ]);
    res.json({ employees: employees.rows, dates: dates.rows });
  } catch (err) { next(err); }
});

// ── חריגות ──────────────────────────────────────────────────────────────────
router.get('/anomalies', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const [long, missing] = await Promise.all([
      pool.query(
        `SELECT te.id, te.date, te.duration_minutes, u.full_name, p.project_name
         FROM time_entries te
         JOIN users u    ON u.id = te.user_id
         JOIN projects p ON p.id = te.project_id
         WHERE te.duration_minutes > 600
         ORDER BY te.duration_minutes DESC LIMIT 20`
      ),
      pool.query(
        `SELECT u.id, u.full_name, u.team, MAX(te.date) AS last_entry_date
         FROM users u LEFT JOIN time_entries te ON te.user_id = u.id
         WHERE u.is_active = TRUE AND u.role = 'employee'
         GROUP BY u.id, u.full_name, u.team
         HAVING MAX(te.date) < NOW() - INTERVAL '7 days' OR MAX(te.date) IS NULL`
      ),
    ]);
    res.json({ longEntries: long.rows, missingActivity: missing.rows });
  } catch (err) { next(err); }
});

module.exports = router;
