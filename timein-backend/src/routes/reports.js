
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT SUM(CASE WHEN date=CURRENT_DATE THEN duration_minutes ELSE 0 END) AS today_minutes, SUM(CASE WHEN date>=date_trunc('week',NOW()) THEN duration_minutes ELSE 0 END) AS week_minutes, SUM(CASE WHEN date>=date_trunc('month',NOW()) THEN duration_minutes ELSE 0 END) AS month_minutes, COUNT(CASE WHEN status='draft' THEN 1 END) AS draft_count FROM time_entries WHERE user_id=$1",
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/by-user', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT u.id,u.full_name,u.team,COUNT(te.id)::int AS entry_count,COALESCE(SUM(te.duration_minutes),0)::int AS total_minutes,ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,COUNT(DISTINCT te.project_id)::int AS project_count FROM users u LEFT JOIN time_entries te ON te.user_id=u.id WHERE u.is_active=TRUE GROUP BY u.id,u.full_name,u.team ORDER BY total_minutes DESC"
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/by-project', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT p.id,p.project_name,COUNT(te.id)::int AS entry_count,COALESCE(SUM(te.duration_minutes),0)::int AS total_minutes,ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,COUNT(DISTINCT te.user_id)::int AS user_count FROM projects p LEFT JOIN time_entries te ON te.project_id=p.id GROUP BY p.id,p.project_name ORDER BY total_minutes DESC"
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/by-task', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT t.id,t.task_name,t.estimated_hours,p.project_name,COUNT(te.id)::int AS entry_count,ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,MAX(te.date) AS last_activity FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN time_entries te ON te.task_id=t.id GROUP BY t.id,t.task_name,t.estimated_hours,p.project_name ORDER BY total_hours DESC NULLS LAST"
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/anomalies', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const [long, missing] = await Promise.all([
      pool.query("SELECT te.*,u.full_name,p.project_name FROM time_entries te JOIN users u ON u.id=te.user_id JOIN projects p ON p.id=te.project_id WHERE te.duration_minutes>600 ORDER BY te.duration_minutes DESC LIMIT 20"),
      pool.query("SELECT u.id,u.full_name,u.team,MAX(te.date) AS last_entry_date FROM users u LEFT JOIN time_entries te ON te.user_id=u.id WHERE u.is_active=TRUE AND u.role='employee' GROUP BY u.id,u.full_name,u.team HAVING MAX(te.date)<NOW()-INTERVAL '7 days' OR MAX(te.date) IS NULL")
    ]);
    res.json({ longEntries: long.rows, missingActivity: missing.rows });
  } catch (err) { next(err); }
});

module.exports = router;
