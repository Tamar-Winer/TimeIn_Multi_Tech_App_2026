
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

function toCSV(rows, fields) {
  const header = fields.map(f => f.label).join(',');
  const lines  = rows.map(r =>
    fields.map(f => {
      const v = r[f.key] != null ? r[f.key] : '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    }).join(',')
  );
  return '﻿' + [header, ...lines].join('\r\n');
}

// Export time entries as CSV
router.get('/time-entries', authenticate, async (req, res, next) => {
  try {
    const { dateFrom, dateTo, userId, projectId, status } = req.query;
    const conds = [], vals = [];

    if (req.user.role === 'employee') {
      conds.push(`te.user_id = $${vals.length + 1}`); vals.push(req.user.id);
    } else if (userId) {
      conds.push(`te.user_id = $${vals.length + 1}`); vals.push(userId);
    }
    if (projectId) { conds.push(`te.project_id = $${vals.length + 1}`); vals.push(projectId); }
    if (status)    { conds.push(`te.status = $${vals.length + 1}`);      vals.push(status); }
    if (dateFrom)  { conds.push(`te.date >= $${vals.length + 1}`);       vals.push(dateFrom); }
    if (dateTo)    { conds.push(`te.date <= $${vals.length + 1}`);       vals.push(dateTo); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT te.date, u.full_name AS user_name, p.project_name,
              COALESCE(t.task_name, '') AS task_name,
              te.duration_minutes,
              ROUND(te.duration_minutes / 60.0, 2) AS hours,
              te.work_type, te.status,
              COALESCE(te.description, '') AS description
       FROM time_entries te
       JOIN users u    ON u.id = te.user_id
       JOIN projects p ON p.id = te.project_id
       LEFT JOIN tasks t ON t.id = te.task_id
       ${where}
       ORDER BY te.date DESC, u.full_name`,
      vals
    );

    const csv = toCSV(rows, [
      { key: 'date',             label: 'תאריך' },
      { key: 'user_name',        label: 'עובד' },
      { key: 'project_name',     label: 'פרויקט' },
      { key: 'task_name',        label: 'משימה' },
      { key: 'duration_minutes', label: 'דקות' },
      { key: 'hours',            label: 'שעות' },
      { key: 'work_type',        label: 'סוג עבודה' },
      { key: 'status',           label: 'סטטוס' },
      { key: 'description',      label: 'תיאור' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="time-entries.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// Export report by user as CSV
router.get('/report-by-user', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const conds = [], vals = [];
    if (dateFrom) { conds.push(`te.date >= $${vals.length + 1}`); vals.push(dateFrom); }
    if (dateTo)   { conds.push(`te.date <= $${vals.length + 1}`); vals.push(dateTo); }
    const extra = conds.length ? 'AND ' + conds.join(' AND ') : '';

    const { rows } = await pool.query(
      `SELECT u.full_name, u.email, u.team,
              COUNT(te.id)::int                                   AS entry_count,
              COALESCE(SUM(te.duration_minutes), 0)::int          AS total_minutes,
              ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) AS total_hours
       FROM users u
       LEFT JOIN time_entries te ON te.user_id = u.id ${extra}
       WHERE u.is_active = TRUE
       GROUP BY u.id, u.full_name, u.email, u.team
       ORDER BY total_minutes DESC`,
      vals
    );

    const csv = toCSV(rows, [
      { key: 'full_name',     label: 'שם עובד' },
      { key: 'email',         label: 'אימייל' },
      { key: 'team',          label: 'צוות' },
      { key: 'entry_count',   label: 'מספר דיווחים' },
      { key: 'total_minutes', label: 'דקות סה"כ' },
      { key: 'total_hours',   label: 'שעות סה"כ' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="report-by-user.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// Export report by project as CSV
router.get('/report-by-project', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const conds = [], vals = [];
    if (dateFrom) { conds.push(`te.date >= $${vals.length + 1}`); vals.push(dateFrom); }
    if (dateTo)   { conds.push(`te.date <= $${vals.length + 1}`); vals.push(dateTo); }
    const extra = conds.length ? 'AND ' + conds.join(' AND ') : '';

    const { rows } = await pool.query(
      `SELECT p.project_name,
              COUNT(te.id)::int                                   AS entry_count,
              COALESCE(SUM(te.duration_minutes), 0)::int          AS total_minutes,
              ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) AS total_hours,
              COUNT(DISTINCT te.user_id)::int                     AS user_count
       FROM projects p
       LEFT JOIN time_entries te ON te.project_id = p.id ${extra}
       GROUP BY p.id, p.project_name
       ORDER BY total_minutes DESC`,
      vals
    );

    const csv = toCSV(rows, [
      { key: 'project_name',  label: 'פרויקט' },
      { key: 'entry_count',   label: 'דיווחים' },
      { key: 'total_minutes', label: 'דקות סה"כ' },
      { key: 'total_hours',   label: 'שעות סה"כ' },
      { key: 'user_count',    label: 'עובדים' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="report-by-project.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
