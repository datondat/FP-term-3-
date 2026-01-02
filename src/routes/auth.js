/**
 * src/routes/auth.js
 *
 * Full, explicit auth route implementing:
 *  - POST /api/register    (creates user, hashes password, logs in)
 *  - POST /api/login       (checks credentials, logs in)
 *  - POST /api/logout      (destroys session)
 *  - GET  /api/me          (returns current user if logged in)
 *
 * Behavior:
 *  - Returns JSON for AJAX/JSON requests.
 *  - Preserves compatibility with standard form POSTs by redirecting when the request
 *    does not ask for JSON.
 *
 * Requirements:
 *  - ../db exports `pool` (pg Pool)
 *  - express-session configured in your main app (app.js) before mounting these routes
 *  - table `users` with columns: id, username, password_hash, name, email
 *  - bcrypt installed (npm i bcrypt)
 *
 * Notes:
 *  - This file is intentionally explicit and commented for maintainability.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db');

// Accept both JSON and urlencoded form bodies for convenience
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Helper: detect if request wants JSON (AJAX or Accept header)
function wantsJson(req) {
  if (req.xhr) return true;
  const accept = (req.get('Accept') || '').toLowerCase();
  if (accept.indexOf('application/json') !== -1) return true;
  const contentType = (req.get('Content-Type') || '').toLowerCase();
  if (contentType.indexOf('application/json') !== -1) return true;
  return false;
}

// Helper: return user object safe for sending to client
function safeUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name || null,
    email: row.email || null
  };
}

/**
 * Find user by username.
 */
async function findUserByUsername(username) {
  const sql = 'SELECT id, username, name, email, password_hash FROM users WHERE username = $1 LIMIT 1';
  const r = await pool.query(sql, [username]);
  return r.rows[0] || null;
}

/**
 * Create a new user row. Returns the created user (without password_hash).
 */
async function createUser({ username, password, name, email }) {
  const hash = await bcrypt.hash(password, 12);
  const sql = `
    INSERT INTO users (username, password_hash, name, email)
    VALUES ($1, $2, $3, $4)
    RETURNING id, username, name, email
  `;
  const r = await pool.query(sql, [username, hash, name || null, email || null]);
  return r.rows[0];
}

/**
 * POST /api/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, email } = req.body || {};
    if (!username || !password) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'username and password required' });
      return res.status(400).send('username and password required');
    }

    // Check if username exists
    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [username]);
    if (exists.rows.length) {
      if (wantsJson(req)) return res.status(409).json({ ok: false, error: 'username_exists' });
      return res.redirect('/register?error=username_exists');
    }

    const user = await createUser({ username, password, name, email });

    // Attach to session (login)
    if (req.session) req.session.userId = user.id;

    if (wantsJson(req)) return res.json({ ok: true, user });
    return res.redirect('/');
  } catch (err) {
    console.error('register error', err);
    if (wantsJson(req)) return res.status(500).json({ ok: false, error: err.message || 'server_error' });
    return res.status(500).send('server error');
  }
});

/**
 * POST /api/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'username and password required' });
      return res.status(400).send('username and password required');
    }

    const user = await findUserByUsername(username);
    if (!user) {
      if (wantsJson(req)) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
      return res.redirect('/login?error=invalid_credentials');
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      if (wantsJson(req)) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
      return res.redirect('/login?error=invalid_credentials');
    }

    // success -> set session
    if (req.session) req.session.userId = user.id;

    const safeUser = safeUserRow(user);

    if (wantsJson(req)) return res.json({ ok: true, user: safeUser });

    // non-json: redirect to original page or home
    const redirectTo = req.query.next || req.body.next || '/';
    return res.redirect(redirectTo);
  } catch (err) {
    console.error('login error', err);
    if (wantsJson(req)) return res.status(500).json({ ok: false, error: err.message || 'server_error' });
    return res.status(500).send('server error');
  }
});

/**
 * POST /api/logout
 */
router.post('/logout', (req, res) => {
  try {
    // If no session, treat as success
    if (!req.session) {
      if (wantsJson(req)) return res.json({ ok: true });
      return res.redirect('/');
    }

    // Destroy session
    req.session.destroy(err => {
      // Always attempt to clear cookie used by the session middleware;
      try { res.clearCookie && res.clearCookie('connect.sid'); } catch (e) { /* ignore */ }

      if (err) {
        console.error('session destroy error', err);
        if (wantsJson(req)) return res.status(500).json({ ok: false, error: 'logout_failed' });
        return res.status(500).send('logout failed');
      }
      if (wantsJson(req)) return res.json({ ok: true });
      return res.redirect('/');
    });
  } catch (err) {
    console.error('logout error', err);
    if (wantsJson(req)) return res.status(500).json({ ok: false, error: err.message || 'server_error' });
    return res.status(500).send('server error');
  }
});

/**
 * GET /api/me
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.json({ ok: false });

    const r = await pool.query('SELECT id, username, name, email FROM users WHERE id = $1 LIMIT 1', [req.session.userId]);
    if (!r.rows[0]) return res.json({ ok: false });

    return res.json({ ok: true, user: r.rows[0] });
  } catch (err) {
    console.error('me error', err);
    return res.status(500).json({ ok: false, error: err.message || 'server_error' });
  }
});

module.exports = router;