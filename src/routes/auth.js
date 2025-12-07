// server/auth.js
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'fp',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432
});

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-secure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS, 10) : 10;

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, display_name } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const client = await pool.connect();
    try {
      const check = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username]);
      if (check.rowCount > 0) return res.status(409).json({ error: 'Username already registered' });

      const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const role = 'student';
      const insert = await client.query(
        `INSERT INTO users (username, display_name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, display_name, role, created_at`,
        [username, display_name || null, password_hash, role]
      );

      const user = insert.rows[0];
      const token = generateToken({ userId: user.id, username: user.username, role: user.role });

      return res.status(201).json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role }, token });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const client = await pool.connect();
    try {
      const lookup = await client.query('SELECT id, username, display_name, password_hash, role FROM users WHERE username = $1 LIMIT 1', [username]);
      if (lookup.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
      const user = lookup.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const token = generateToken({ userId: user.id, username: user.username, role: user.role });
      return res.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role }, token });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const client = await pool.connect();
    try {
      const q = await client.query('SELECT id, username, display_name, role, created_at FROM users WHERE id = $1 LIMIT 1', [payload.userId]);
      if (q.rowCount === 0) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: q.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;