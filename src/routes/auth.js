// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const SALT_ROUNDS = 10;

// Register
router.post('/register', async (req, res) => {
  const { username, email, password, displayName } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });
  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const client = await pool.connect();
    try {
      const insert = await client.query(
        `INSERT INTO users (username, email, password_hash, display_name)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (username) DO NOTHING
         RETURNING id, username, email, display_name`,
        [username, email || null, hashed, displayName || null]
      );
      if (!insert.rows[0]) return res.status(400).json({ ok: false, error: 'username already exists' });
      const user = insert.rows[0];
      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.display_name }, token });
    } finally { client.release(); }
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT id, username, password_hash, display_name FROM users WHERE username=$1 LIMIT 1', [username]);
      const user = r.rows[0];
      if (!user) return res.status(401).json({ ok: false, error: 'invalid credentials' });
      const okPass = await bcrypt.compare(password, user.password_hash || '');
      if (!okPass) return res.status(401).json({ ok: false, error: 'invalid credentials' });
      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.display_name }, token });
    } finally { client.release(); }
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Middleware to protect endpoints
function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ ok: false, error: 'missing token' });
  const token = m[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, username: payload.username };
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }
}

// Get current user (require token)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT id, username, email, display_name FROM users WHERE id=$1 LIMIT 1', [req.user.id]);
      if (!r.rows[0]) return res.status(404).json({ ok: false, error: 'user not found' });
      const u = r.rows[0];
      res.json({ ok: true, user: { id: u.id, username: u.username, displayName: u.display_name, email: u.email } });
    } finally { client.release(); }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;