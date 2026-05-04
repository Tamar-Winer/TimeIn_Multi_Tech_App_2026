
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

function dateWhere(dateFrom, dateTo, col, startIdx = 1) {
  const conds = [], vals = [];
  if (dateFrom) { conds.push(`${col} >= $${startIdx + vals.length}`); vals.push(dateFrom); }
  if (dateTo)   { conds.push(`${col} <= $${startIdx + vals.length}`); vals.push(dateTo); }
  return { conds, vals };
}

// Returns member IDs for the manager's team(s), or null for admin (no restriction)
async function getManagerMemberIds(user) {
  if (user.role === 'admin') return null;
  const { rows } = await pool.query(
    `SELECT u.id FROM users u
     JOIN teams t ON t.id = u.team_id
     WHERE t.manager_id = $1`,
    [user.id]
  );
  return rows.map(r => r.id);
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

router.get('/my-task-breakdown', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(t.task_name, 'ללא משימה') AS task_name,
              t.id AS task_id,
              p.project_name,
              COALESCE(SUM(te.duration_minutes), 0)::int          AS total_minutes,
              ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) AS total_hours,
              COUNT(te.id)::int                                    AS entry_count
       FROM time_entries te
       JOIN projects p ON p.id = te.project_id
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.user_id = $1
         AND te.date >= date_trunc('month', NOW())
       GROUP BY t.id, t.task_name, p.project_name
       ORDER BY total_minutes DESC
       LIMIT 10`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── לפי עובד ────────────────────────────────────────────────────────────────
router.get('/by-user', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const { conds, vals } = dateWhere(dateFrom, dateTo, 'te.date');

    const memberIds = await getManagerMemberIds(req.user);
    if (memberIds !== null && !memberIds.length) return res.json([]);

    let userWhere = '';
    if (memberIds !== null) {
      vals.push(memberIds);
      userWhere = `AND u.id = ANY($${vals.length}::int[])`;
    }

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
       WHERE u.is_active = TRUE ${userWhere}
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

    const memberIds = await getManagerMemberIds(req.user);
    if (memberIds !== null && !memberIds.includes(Number(userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

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

    const memberIds = await getManagerMemberIds(req.user);
    if (memberIds !== null && !memberIds.length) return res.json([]);

    let memberFilter = '';
    if (memberIds !== null) {
      vals.push(memberIds);
      memberFilter = `te.user_id = ANY($${vals.length}::int[])`;
    }

    const joinExtra = [...conds, memberFilter].filter(Boolean).join(' AND ');
    const joinClause = joinExtra ? 'AND ' + joinExtra : '';

    const { rows } = await pool.query(
      `SELECT p.id, p.project_name,
         COUNT(te.id)::int                                         AS entry_count,
         COALESCE(SUM(te.duration_minutes),0)::int                 AS total_minutes,
         ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2)        AS total_hours,
         COUNT(DISTINCT te.user_id)::int                           AS user_count,
         COUNT(DISTINCT te.task_id)::int                           AS task_count
       FROM projects p
       LEFT JOIN time_entries te ON te.project_id = p.id ${joinClause}
       GROUP BY p.id, p.project_name
       ${memberIds !== null ? 'HAVING COUNT(te.id) > 0' : ''}
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

    const memberIds = await getManagerMemberIds(req.user);
    if (memberIds !== null && !memberIds.length) {
      return res.json({ employees: [], tasks: [] });
    }

    let memberWhere = '';
    if (memberIds !== null) {
      allVals.push(memberIds);
      memberWhere = `AND te.user_id = ANY($${allVals.length}::int[])`;
    }

    const [employees, tasks] = await Promise.all([
      pool.query(
        `SELECT u.id, u.full_name, u.team,
           COALESCE(SUM(te.duration_minutes),0)::int          AS total_minutes,
           ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,
           COUNT(te.id)::int                                   AS entry_count
         FROM time_entries te JOIN users u ON u.id = te.user_id
         WHERE te.project_id = $1 ${extra} ${memberWhere}
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
         WHERE te.project_id = $1 ${extra} ${memberWhere}
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

    const memberIds = await getManagerMemberIds(req.user);
    if (memberIds !== null && !memberIds.length) return res.json([]);

    let memberFilter = '';
    if (memberIds !== null) {
      vals.push(memberIds);
      memberFilter = `te.user_id = ANY($${vals.length}::int[])`;
    }

    const joinExtra = [...conds, memberFilter].filter(Boolean).join(' AND ');
    const joinClause = joinExtra ? 'AND ' + joinExtra : '';

    const { rows } = await pool.query(
      `SELECT t.id, t.task_name, t.estimated_hours, p.project_name,
         COUNT(te.id)::int                                         AS entry_count,
         COALESCE(SUM(te.duration_minutes),0)::int                 AS total_minutes,
         ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2)        AS total_hours,
         COUNT(DISTINCT te.user_id)::int                           AS user_count,
         MAX(te.date)                                              AS last_activity
       FROM tasks t
       LEFT JOIN projects p        ON p.id = t.project_id
       LEFT JOIN time_entries te   ON te.task_id = t.id ${joinClause}
       GROUP BY t.id, t.task_name, t.estimated_hours, p.project_name
       ${memberIds !== null ? 'HAVING COUNT(te.id) > 0' : ''}
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

    const memberIds = await getManagerMemberIds(req.user);
    if (memberIds !== null && !memberIds.length) {
      return res.json({ employees: [], dates: [] });
    }

    let memberWhere = '';
    if (memberIds !== null) {
      allVals.push(memberIds);
      memberWhere = `AND te.user_id = ANY($${allVals.length}::int[])`;
    }

    const [employees, dates] = await Promise.all([
      pool.query(
        `SELECT u.id, u.full_name,
           COALESCE(SUM(te.duration_minutes),0)::int          AS total_minutes,
           ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,
           COUNT(te.id)::int                                   AS entry_count
         FROM time_entries te JOIN users u ON u.id = te.user_id
         WHERE te.task_id = $1 ${extra} ${memberWhere}
         GROUP BY u.id, u.full_name ORDER BY total_minutes DESC`,
        allVals
      ),
      pool.query(
        `SELECT te.date, u.full_name, te.duration_minutes
         FROM time_entries te JOIN users u ON u.id = te.user_id
         WHERE te.task_id = $1 ${extra} ${memberWhere}
         ORDER BY te.date DESC LIMIT 50`,
        allVals
      ),
    ]);
    res.json({ employees: employees.rows, dates: dates.rows });
  } catch (err) { next(err); }
});

// ── Estimate vs Actual ───────────────────────────────────────────────────────
router.get('/estimate-vs-actual', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const { conds, vals } = dateWhere(dateFrom, dateTo, 'te.date');

    const memberIds = await getManagerMemberIds(req.user);
    if (memberIds !== null && !memberIds.length) return res.json([]);

    let memberFilter = '';
    if (memberIds !== null) {
      vals.push(memberIds);
      memberFilter = `te.user_id = ANY($${vals.length}::int[])`;
    }

    const joinExtra = [...conds, memberFilter].filter(Boolean).join(' AND ');
    const joinClause = joinExtra ? 'AND ' + joinExtra : '';

    const { rows } = await pool.query(
      `SELECT t.id, t.task_name, p.project_name,
              COALESCE(t.estimated_hours, 0)::float                        AS estimated_hours,
              ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2)       AS actual_hours,
              ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) -
                    COALESCE(t.estimated_hours, 0)                          AS variance_hours,
              CASE
                WHEN COALESCE(t.estimated_hours, 0) = 0 THEN NULL
                ELSE ROUND(
                  ((COALESCE(SUM(te.duration_minutes), 0) / 60.0) /
                   t.estimated_hours - 1) * 100, 1
                )
              END                                                            AS variance_pct,
              COUNT(te.id)::int                                              AS entry_count,
              COUNT(DISTINCT te.user_id)::int                               AS user_count
       FROM tasks t
       LEFT JOIN projects p      ON p.id = t.project_id
       LEFT JOIN time_entries te ON te.task_id = t.id ${joinClause}
       WHERE t.estimated_hours IS NOT NULL AND t.estimated_hours > 0
       GROUP BY t.id, t.task_name, t.estimated_hours, p.project_name
       ORDER BY ABS(
         ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) -
         COALESCE(t.estimated_hours, 0)
       ) DESC`,
      vals
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── חריגות ──────────────────────────────────────────────────────────────────
router.get('/anomalies', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const memberIds = await getManagerMemberIds(req.user);
    if (memberIds !== null && !memberIds.length) {
      return res.json({ longEntries: [], missingActivity: [], overlappingEntries: [] });
    }

    const memberFilter = memberIds !== null
      ? `AND te.user_id = ANY(ARRAY[${memberIds.join(',')}]::int[])`
      : '';
    const userFilter = memberIds !== null
      ? `AND u.id = ANY(ARRAY[${memberIds.join(',')}]::int[])`
      : '';

    const [long, missing, overlaps] = await Promise.all([
      pool.query(
        `SELECT te.id, te.date, te.duration_minutes, u.full_name, p.project_name
         FROM time_entries te
         JOIN users u    ON u.id = te.user_id
         JOIN projects p ON p.id = te.project_id
         WHERE te.duration_minutes > 600 ${memberFilter}
         ORDER BY te.duration_minutes DESC LIMIT 20`
      ),
      pool.query(
        `SELECT u.id, u.full_name, u.team, MAX(te.date) AS last_entry_date
         FROM users u LEFT JOIN time_entries te ON te.user_id = u.id
         WHERE u.is_active = TRUE AND u.role = 'employee' ${userFilter}
         GROUP BY u.id, u.full_name, u.team
         HAVING MAX(te.date) < NOW() - INTERVAL '7 days' OR MAX(te.date) IS NULL`
      ),
      pool.query(
        `SELECT a.id AS entry_a_id, b.id AS entry_b_id,
                u.full_name, a.date,
                a.start_time, a.end_time,
                b.start_time AS b_start_time, b.end_time AS b_end_time,
                pa.project_name AS project_a, pb.project_name AS project_b
         FROM time_entries a
         JOIN time_entries b  ON a.user_id = b.user_id
                              AND a.date   = b.date
                              AND a.id     < b.id
                              AND a.start_time IS NOT NULL AND a.end_time IS NOT NULL
                              AND b.start_time IS NOT NULL AND b.end_time IS NOT NULL
                              AND (a.start_time, a.end_time) OVERLAPS (b.start_time, b.end_time)
         JOIN users u         ON u.id = a.user_id
         JOIN projects pa     ON pa.id = a.project_id
         JOIN projects pb     ON pb.id = b.project_id
         WHERE TRUE ${memberIds !== null ? `AND a.user_id = ANY(ARRAY[${memberIds.join(',')}]::int[])` : ''}
         ORDER BY a.date DESC LIMIT 20`
      ),
    ]);
    res.json({ longEntries: long.rows, missingActivity: missing.rows, overlappingEntries: overlaps.rows });
  } catch (err) { next(err); }
});

module.exports = router;
