
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

function toCSV(rows, fields) {
  const header = fields.map(f => f.label).join(',');
  const lines  = rows.map(r =>
    fields.map(f => {
      const v = r[f.key] != null ? r[f.key] : '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')
  );
  return '﻿' + [header, ...lines].join('\r\n');
}

// GET payroll summary
router.get('/summary', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const conds = [], vals = [];
    if (dateFrom) { conds.push(`te.date >= $${vals.length + 1}`); vals.push(dateFrom); }
    if (dateTo)   { conds.push(`te.date <= $${vals.length + 1}`); vals.push(dateTo); }
    const extra = conds.length ? 'AND ' + conds.join(' AND ') : '';

    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.team,
              COALESCE(u.hourly_rate, 0)::float                          AS hourly_rate,
              COALESCE(SUM(te.duration_minutes), 0)::int                 AS total_minutes,
              ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2)    AS total_hours,
              ROUND((COALESCE(SUM(te.duration_minutes), 0) / 60.0) *
                    COALESCE(u.hourly_rate, 0), 2)                       AS total_pay
       FROM users u
       LEFT JOIN time_entries te ON te.user_id = u.id
                                 AND te.status = 'approved' ${extra}
       WHERE u.is_active = TRUE AND u.role = 'employee'
       GROUP BY u.id, u.full_name, u.email, u.team, u.hourly_rate
       ORDER BY u.full_name`,
      vals
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PATCH — update hourly rate for a user
router.patch('/rate/:userId', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { hourlyRate } = req.body;
    if (hourlyRate == null || isNaN(hourlyRate)) return res.status(400).json({ error: 'hourlyRate required' });
    await pool.query(
      'UPDATE users SET hourly_rate=$1, updated_at=NOW() WHERE id=$2',
      [hourlyRate, req.params.userId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET payroll CSV export (approved hours only)
router.get('/export', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const conds = [], vals = [];
    if (dateFrom) { conds.push(`te.date >= $${vals.length + 1}`); vals.push(dateFrom); }
    if (dateTo)   { conds.push(`te.date <= $${vals.length + 1}`); vals.push(dateTo); }
    const extra = conds.length ? 'AND ' + conds.join(' AND ') : '';

    const { rows } = await pool.query(
      `SELECT u.full_name, u.email, u.team,
              COALESCE(u.hourly_rate, 0)::float                          AS hourly_rate,
              ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2)    AS total_hours,
              ROUND((COALESCE(SUM(te.duration_minutes), 0) / 60.0) *
                    COALESCE(u.hourly_rate, 0), 2)                       AS total_pay
       FROM users u
       LEFT JOIN time_entries te ON te.user_id = u.id
                                 AND te.status = 'approved' ${extra}
       WHERE u.is_active = TRUE AND u.role = 'employee'
       GROUP BY u.id, u.full_name, u.email, u.team, u.hourly_rate
       ORDER BY u.full_name`,
      vals
    );

    const csv = toCSV(rows, [
      { key: 'full_name',   label: 'שם עובד' },
      { key: 'email',       label: 'אימייל' },
      { key: 'team',        label: 'צוות' },
      { key: 'hourly_rate', label: 'שכר לשעה (₪)' },
      { key: 'total_hours', label: 'שעות אושרו' },
      { key: 'total_pay',   label: 'שכר לתשלום (₪)' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payroll.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
