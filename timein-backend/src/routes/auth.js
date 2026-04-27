
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.post('/register', async (req, res, next) => {
  const { fullName, email, password, role = 'employee', team } = req.body;
  if (!fullName || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (full_name,email,password_hash,role,team) VALUES ($1,$2,$3,$4,$5) RETURNING id,full_name,email,role,team',
      [fullName, email, hash, role, team]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const { password_hash, ...user } = rows[0];
    res.json({ token, user });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, (req, res) => res.json(req.user));
module.exports = router;
