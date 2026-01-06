/**
 * src/routes/auth.js
 * POST /api/register
 * POST /api/login
 * POST /api/logout
 * GET  /api/me
 *
 * Notes:
 * - This version returns the user's role (e.g. "user" or "admin") in responses.
 * - It will accept either username or email for login.
 * - Requires src/db.js that exports { pool } (pg Pool).
 * - Ensure express-session is configured in server.js before mounting this router.
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

// Helper: return user object safe for sending to client (includes role)
function safeUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name || null,
    email: row.email || null,
    role: row.role || 'user'
  };
}

/**
 * Find user by username OR email.
 * Returns full row including password_hash and role.
 */
async function findUserByIdentifier(identifier) {
  const sql = 'SELECT id, username, name, email, password_hash, role FROM users WHERE username = $1 OR email = $1 LIMIT 1';
  const r = await pool.query(sql, [identifier]);
  return r.rows[0] || null;
}

/**
 * Create a new user row. Returns the created user (without password_hash).
 * By default role is left to DB default (should be 'user'), but you may pass role to override.
 */
async function createUser({ username, password, name, email, role }) {
  const hash = await bcrypt.hash(password, 12);
  // If role explicitly provided, insert it; else rely on DB default.
  if (role) {
    const sql = `
      INSERT INTO users (username, password_hash, name, email, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, name, email, role
    `;
    const r = await pool.query(sql, [username, hash, name || null, email || null, role]);
    return r.rows[0];
  } else {
    const sql = `
      INSERT INTO users (username, password_hash, name, email)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, name, email, role
    `;
    const r = await pool.query(sql, [username, hash, name || null, email || null]);
    return r.rows[0];
  }
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

    // Check if username or email exists
    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1 OR email = $2 LIMIT 1', [username, email || '']);
    if (exists.rows.length) {
      if (wantsJson(req)) return res.status(409).json({ ok: false, error: 'username_or_email_exists' });
      return res.redirect('/register?error=username_or_email_exists');
    }

    const user = await createUser({ username, password, name, email });
    // Attach to session (login)
    if (req.session) req.session.userId = user.id;

    if (wantsJson(req)) return res.json({ ok: true, user: safeUserRow(user) });
    return res.redirect('/');
  } catch (err) {
    console.error('register error', err);
    if (wantsJson(req)) return res.status(500).json({ ok: false, error: err.message || 'server_error' });
    return res.status(500).send('server error');
  }
});

/**
 * POST /api/login
 * Accepts JSON or form: { username: '...', password: '...' }
 * username may be username OR email.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'username and password required' });
      return res.status(400).send('username and password required');
    }

    const user = await findUserByIdentifier(username);
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
 * Returns { ok:true, user: { id, username, name, email, role } } when logged in
 * Otherwise { ok: false }
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.json({ ok: false });

    const r = await pool.query('SELECT id, username, name, email, role FROM users WHERE id = $1 LIMIT 1', [req.session.userId]);
    if (!r.rows[0]) return res.json({ ok: false });

    return res.json({ ok: true, user: safeUserRow(r.rows[0]) });
  } catch (err) {
    console.error('me error', err);
    return res.status(500).json({ ok: false, error: err.message || 'server_error' });
  }
});

module.exports = router;