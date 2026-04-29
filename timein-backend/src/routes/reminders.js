
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET reminder config
router.get('/config', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT key, value FROM settings WHERE key LIKE 'reminder_%'"
    );
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      enabled: cfg.reminder_enabled === 'true',
      hour: parseInt(cfg.reminder_hour || '17', 10),
    });
  } catch (err) { next(err); }
});

// POST save reminder config
router.post('/config', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { enabled, hour } = req.body;
    const updates = [];
    if (enabled !== undefined) updates.push(['reminder_enabled', String(enabled)]);
    if (hour    !== undefined) updates.push(['reminder_hour',    String(hour)]);
    await Promise.all(updates.map(([k, v]) =>
      pool.query(
        `INSERT INTO settings (key,value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [k, v]
      )
    ));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET retroactive policy config
router.get('/retroactive-config', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('retroactive_allowed','retroactive_max_days')"
    );
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      allowed: cfg.retroactive_allowed !== 'false',
      maxDays: cfg.retroactive_max_days ? parseInt(cfg.retroactive_max_days, 10) : 30,
    });
  } catch (err) { next(err); }
});

// POST save retroactive policy config
router.post('/retroactive-config', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { allowed, maxDays } = req.body;
    const updates = [];
    if (allowed  !== undefined) updates.push(['retroactive_allowed',  String(allowed)]);
    if (maxDays  !== undefined) updates.push(['retroactive_max_days', String(maxDays)]);
    await Promise.all(updates.map(([k, v]) =>
      pool.query(
        `INSERT INTO settings (key,value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [k, v]
      )
    ));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET employees who haven't reported today
router.get('/missing-today', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.team
       FROM users u
       WHERE u.is_active = TRUE AND u.role = 'employee'
         AND NOT EXISTS (
           SELECT 1 FROM time_entries te
           WHERE te.user_id = u.id AND te.date = CURRENT_DATE
         )
       ORDER BY u.team, u.full_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST trigger reminders (manual)
router.post('/trigger', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { rows: missing } = await pool.query(
      `SELECT u.id, u.full_name
       FROM users u
       WHERE u.is_active = TRUE AND u.role = 'employee'
         AND NOT EXISTS (
           SELECT 1 FROM time_entries te
           WHERE te.user_id = u.id AND te.date = CURRENT_DATE
         )
       ORDER BY u.full_name`
    );

    if (!missing.length) {
      return res.json({ sent: 0, message: 'כל העובדים דיווחו שעות היום' });
    }

    // Create in-app notifications
    await Promise.all(missing.map(u =>
      pool.query(
        `INSERT INTO notifications (user_id, message, link)
         VALUES ($1, $2, $3)`,
        [u.id, 'תזכורת: טרם דיווחת שעות עבודה להיום. אנא הוסף דיווח.', '/report']
      )
    ));

    // Send to Slack if configured
    const { rows: cfg } = await pool.query(
      "SELECT value FROM settings WHERE key IN ('slack_webhook_url','slack_enabled')"
    );
    const settings = Object.fromEntries(cfg.map(r => [r.key, r.value]));
    if (settings.slack_webhook_url && settings.slack_enabled === 'true') {
      try {
        const { sendSlack } = require('./slack');
        const names = missing.map(u => u.full_name).join(', ');
        await sendSlack(
          settings.slack_webhook_url,
          `⏰ *תזכורת שעות TimeIn*: ${missing.length} עובדים טרם דיווחו היום:\n${names}`
        );
      } catch (_) {}
    }

    res.json({ sent: missing.length, users: missing.map(u => u.full_name) });
  } catch (err) { next(err); }
});

module.exports = router;
