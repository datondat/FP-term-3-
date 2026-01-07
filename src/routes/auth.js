/**
 * src/routes/auth.js
 * - cookie-session friendly (no req.session.save/destroy)
 * - POST /api/login returns JSON { ok:true, user:{...} } for AJAX clients
 * - Non-AJAX form submit redirects to /admin when role==='admin'
 * - POST /api/logout always returns JSON { ok:true }
 */
const express = require('express');
const router = express.Router();

let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  console.warn('bcrypt native not available, falling back to bcryptjs.');
  bcrypt = require('bcryptjs');
}

const { pool } = require('../db');

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

function wantsJson(req) {
  // Consider X-Requested-With header (common for AJAX libraries)
  const xrw = (req.get('X-Requested-With') || '').toLowerCase();
  if (xrw === 'xmlhttprequest') return true;

  if (req.xhr) return true;
  const accept = (req.get('Accept') || '').toLowerCase();
  if (accept.indexOf('application/json') !== -1) return true;
  const contentType = (req.get('Content-Type') || '').toLowerCase();
  if (contentType.indexOf('application/json') !== -1) return true;
  return false;
}

function safeUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role || 'user',
    displayName: row.display_name || row.displayName || null
  };
}

async function findUserByIdentifier(identifier) {
  const sql = 'SELECT id, username, password_hash, role, display_name FROM users WHERE username = $1 LIMIT 1';
  const r = await pool.query(sql, [identifier]);
  return r.rows[0] || null;
}

async function createUser({ username, password, role }) {
  const hash = await bcrypt.hash(password, 12);
  if (role) {
    const sql = `
      INSERT INTO users (username, password_hash, role)
      VALUES ($1, $2, $3)
      RETURNING id, username, role
    `;
    const r = await pool.query(sql, [username, hash, role]);
    return r.rows[0];
  } else {
    const sql = `
      INSERT INTO users (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, role
    `;
    const r = await pool.query(sql, [username, hash]);
    return r.rows[0];
  }
}

/** POST /api/register */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'username and password required' });
      return res.status(400).send('username and password required');
    }

    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [username]);
    if (exists.rows.length) {
      if (wantsJson(req)) return res.status(409).json({ ok: false, error: 'username_exists' });
      return res.redirect('/register?error=username_exists');
    }

    const user = await createUser({ username, password });
    if (req.session) req.session.userId = user.id;

    if (wantsJson(req)) return res.json({ ok: true, user: safeUserRow(user) });
    // Non-AJAX: redirect admin -> /admin, others -> /
    const redirectTo = (user && user.role === 'admin') ? '/admin' : '/';
    return res.redirect(redirectTo);
  } catch (err) {
    console.error('register error', err);
    if (wantsJson(req)) return res.status(500).json({ ok: false, error: err.message || 'server_error' });
    return res.status(500).send('server error');
  }
});

/** POST /api/login */
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

    // Set session (cookie-session)
    if (req.session) req.session.userId = user.id;

    // For AJAX clients return JSON including role
    if (wantsJson(req)) return res.json({ ok: true, user: safeUserRow(user) });

    // Non-AJAX: redirect admin to /admin, others to next or home
    const redirectToQuery = req.query.next || req.body.next;
    if (redirectToQuery) return res.redirect(redirectToQuery);
    const redirectTo = (user && user.role === 'admin') ? '/admin' : '/';
    return res.redirect(redirectTo);
  } catch (err) {
    console.error('login error', err);
    if (wantsJson(req)) return res.status(500).json({ ok: false, error: err.message || 'server_error' });
    return res.status(500).send('server error');
  }
});

/** POST /api/logout — always return JSON */
router.post('/logout', (req, res) => {
  try {
    console.log('logout called — cookie-session present?', !!req.session, 'session.userId=', req.session && req.session.userId);
    try { if (req.session) req.session = null; } catch (e) { console.error('error clearing cookie-session', e); }
    return res.json({ ok: true });
  } catch (err) {
    console.error('logout error', err);
    try { return res.json({ ok: true, warning: 'logout_exception' }); } catch(e) { return res.status(200).send('ok'); }
  }
});

router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.json({ ok: false });
    const r = await pool.query('SELECT id, username, role, display_name FROM users WHERE id = $1 LIMIT 1', [req.session.userId]);
    if (!r.rows[0]) return res.json({ ok: false });
    return res.json({ ok: true, user: safeUserRow(r.rows[0]) });
  } catch (err) {
    console.error('me error', err);
    return res.status(500).json({ ok: false, error: err.message || 'server_error' });
  }
});

module.exports = router;