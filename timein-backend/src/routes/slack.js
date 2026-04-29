
const router = require('express').Router();
const pool   = require('../config/db');
const https  = require('https');
const { authenticate, requireRole } = require('../middleware/auth');

async function sendSlack(webhookUrl, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text });
    const url  = new URL(webhookUrl);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// GET Slack config (masked)
router.get('/config', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('slack_webhook_url','slack_enabled')"
    );
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const url = cfg.slack_webhook_url || '';
    res.json({
      configured: url.length > 0,
      webhook_masked: url.length > 30 ? url.slice(0, 30) + '...' : url,
      enabled: cfg.slack_enabled === 'true',
    });
  } catch (err) { next(err); }
});

// POST save Slack config
router.post('/config', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { webhookUrl, enabled } = req.body;
    const updates = [];
    if (webhookUrl !== undefined) updates.push(['slack_webhook_url', webhookUrl]);
    if (enabled    !== undefined) updates.push(['slack_enabled',     String(enabled)]);
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

// POST test Slack connection
router.post('/test', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='slack_webhook_url'");
    const url = rows[0]?.value;
    if (!url) return res.status(400).json({ error: 'לא הוגדר Webhook URL' });
    const result = await sendSlack(url, '✅ *TimeIn*: בדיקת חיבור Slack עברה בהצלחה!');
    if (result.status !== 200) return res.status(502).json({ error: `Slack returned ${result.status}` });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST send a custom message to Slack
router.post('/send', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const { rows } = await pool.query(
      "SELECT value FROM settings WHERE key='slack_webhook_url'"
    );
    const url = rows[0]?.value;
    if (!url) return res.status(400).json({ error: 'Slack לא מוגדר' });
    await sendSlack(url, message);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.sendSlack = sendSlack;
