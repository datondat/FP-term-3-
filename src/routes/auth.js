'use strict';
/**
 * src/routes/auth.js
 * Auth routes: register, login, me
 * Exports router (mounted at /api/auth) and attaches authMiddleware as property on router.
 *
 * Requirements:
 * - src/db must export { pool } (pg Pool) or module exporting pool connection
 * - users table should have columns: id, username, display_name, password_hash, role, created_at
 *
 * Behavior:
 * - register/login return JSON { user, token } and also set cookie 'auth_token' HttpOnly.
 * - me reads token from Authorization: Bearer <token> or cookie 'auth_token'.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Use DB pool from src/db (consistent with other routes)
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-secure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS, 10) : 10;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const COOKIE_MAX_AGE = process.env.AUTH_COOKIE_MAX_AGE ? parseInt(process.env.AUTH_COOKIE_MAX_AGE, 10) : (7 * 24 * 60 * 60 * 1000); // 7 days

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function setAuthCookie(res, token) {
  // httpOnly cookie to support credentials:'include' style auth
  // Secure only if running under https (NODE_ENV=production recommended)
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE
  };
  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false') {
    cookieOpts.secure = true;
  }
  res.cookie(COOKIE_NAME, token, cookieOpts);
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, display_name } = req.body || {};
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

      // set cookie for convenience (HttpOnly)
      try { setAuthCookie(res, token); } catch (e) { /* ignore cookie set errors */ }

      return res.status(201).json({
        user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role },
        token
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('register error', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const client = await pool.connect();
    try {
      const lookup = await client.query('SELECT id, username, display_name, password_hash, role FROM users WHERE username = $1 LIMIT 1', [username]);
      if (lookup.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
      const user = lookup.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const token = generateToken({ userId: user.id, username: user.username, role: user.role });

      // set cookie
      try { setAuthCookie(res, token); } catch (e) { /* ignore */ }

      return res.json({
        user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role },
        token
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('login error', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout  (optional helper)
router.post('/logout', async (req, res) => {
  try {
    clearAuthCookie(res);
    return res.json({ ok: true });
  } catch (err) {
    console.error('logout error', err && (err.stack || err.message || err));
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// Helper to extract token from Authorization header or cookie
function extractTokenFromRequest(req) {
  const auth = req.headers && req.headers.authorization;
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  // cookie
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  // alternative header
  if (req.headers['x-auth-token']) return req.headers['x-auth-token'];
  return null;
}

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const client = await pool.connect();
    try {
      const q = await client.query('SELECT id, username, display_name, role, created_at FROM users WHERE id = $1 LIMIT 1', [payload.userId]);
      if (q.rowCount === 0) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: q.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('me error', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// authMiddleware for protecting routes: verifies token and attaches req.user
async function authMiddleware(req, res, next) {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }

    // fetch user row
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT id, username, display_name, role FROM users WHERE id = $1 LIMIT 1', [payload.userId]);
      if (r.rowCount === 0) return res.status(401).json({ ok: false, error: 'User not found' });
      req.user = r.rows[0];
      return next();
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('authMiddleware error', err && (err.stack || err.message || err));
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

// Attach middleware property to router so other modules can do:
// const { authMiddleware } = require('./auth');
router.authMiddleware = authMiddleware;

// Export router as module.exports (server.js uses require('./src/routes/auth') to mount)
module.exports = router;