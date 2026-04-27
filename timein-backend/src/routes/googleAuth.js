
const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
require('dotenv').config();

// POST /api/auth/google  – מקבל Google credential JWT ומחזיר JWT של המערכת
router.post('/google', async (req, res, next) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  try {
    // פענוח ה-JWT של Google (חלק payload הוא base64url)
    const base64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    const { sub: googleId, email, name } = payload;

    if (!email) return res.status(400).json({ error: 'No email from Google' });

    // חפש משתמש קיים לפי google_id או email
    let { rows } = await pool.query(
      'SELECT * FROM users WHERE google_id=$1 OR email=$2 LIMIT 1',
      [googleId, email]
    );

    let user;
    if (rows.length) {
      user = rows[0];
      // קשר את google_id אם עדיין לא קיים
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id=$1 WHERE id=$2', [googleId, user.id]);
        user.google_id = googleId;
      }
    } else {
      // משתמש חדש – צור אוטומטית כ-employee
      const { rows: newRows } = await pool.query(
        'INSERT INTO users (full_name, email, google_id, role, is_active) VALUES ($1,$2,$3,$4,TRUE) RETURNING *',
        [name || email, email, googleId, 'employee']
      );
      user = newRows[0];
    }

    if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) { next(err); }
});

module.exports = router;
