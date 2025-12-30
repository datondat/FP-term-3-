// src/routes/auth.js
// Routes: /api/register, /api/login, /api/logout, /api/me
// Assumes you have a DB client pool in ../db exporting `pool`
// and a users table with columns: id, username, password_hash, name, email
// Uses bcrypt for password hashing and express-session for session management.
// If your project uses a different session store, adapt accordingly.

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db');

// Helper: get user by username or email
async function findUserByUsername(username) {
  const q = 'SELECT id, username, name, email, password_hash FROM users WHERE username = $1 LIMIT 1';
  const r = await pool.query(q, [username]);
  return r.rows[0] || null;
}

async function createUser({ username, password, name, email }) {
  const hash = await bcrypt.hash(password, 12);
  const q = 'INSERT INTO users (username, password_hash, name, email) VALUES ($1,$2,$3,$4) RETURNING id, username, name, email';
  const r = await pool.query(q, [username, hash, name || null, email || null]);
  return r.rows[0];
}

// POST /api/register
router.post('/register', express.json(), async (req, res) => {
  try {
    const { username, password, name, email } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });

    // check existence
    const exists = await pool.query('SELECT 1 FROM users WHERE username=$1 LIMIT 1', [username]);
    if (exists.rows.length) return res.status(409).json({ ok: false, error: 'username_exists' });

    const user = await createUser({ username, password, name, email });

    // attach to session
    if (req.session) {
      req.session.userId = user.id;
    }

    return res.json({ ok: true, user });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ ok: false, error: err.message || 'server_error' });
  }
});

// POST /api/login
router.post('/login', express.json(), async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });

    const user = await findUserByUsername(username);
    if (!user) return res.status(401).json({ ok: false, error: 'invalid_credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ ok: false, error: 'invalid_credentials' });

    // Authentication OK: store user id in session
    if (req.session) {
      req.session.userId = user.id;
    }

    // Do not return password_hash
    const safeUser = { id: user.id, username: user.username, name: user.name, email: user.email };
    return res.json({ ok: true, user: safeUser });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ ok: false, error: err.message || 'server_error' });
  }
});

// POST /api/logout
router.post('/logout', async (req, res) => {
  try {
    if (req.session) {
      req.session.destroy(err => {
        if (err) {
          console.error('session destroy error', err);
          // clear cookie as fallback
          res.clearCookie && res.clearCookie('connect.sid');
          return res.status(500).json({ ok: false, error: 'logout_failed' });
        } else {
          res.clearCookie && res.clearCookie('connect.sid');
          return res.json({ ok: true });
        }
      });
    } else {
      return res.json({ ok: true });
    }
  } catch (err) {
    console.error('logout error', err);
    return res.status(500).json({ ok: false, error: err.message || 'server_error' });
  }
});

// GET /api/me
router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.json({ ok: false });
    const r = await pool.query('SELECT id, username, name, email FROM users WHERE id=$1 LIMIT 1', [req.session.userId]);
    if (!r.rows[0]) return res.json({ ok: false });
    return res.json({ ok: true, user: r.rows[0] });
  } catch (err) {
    console.error('me error', err);
    return res.status(500).json({ ok: false, error: err.message || 'server_error' });
  }
});

module.exports = router;