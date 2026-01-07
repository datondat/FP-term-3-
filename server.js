'use strict';
/**
 * server.js
 * Entry point (full file).
 *
 * Changes made:
 * - Ensure API routers are mounted before serving static files to avoid returning HTML for API requests
 *   when a router fails to mount.
 * - Try mounting admin router from ./src/routes/admin first, then fallback to ./server/admin if present.
 * - Improve error logging when a router fails to mount (print stack).
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const session = require('express-session');
require('dotenv').config();

const app = express();

console.log('==== Starting server ====');
console.log('File:', __filename);
console.log('CWD :', process.cwd());
console.log('PID :', process.pid);
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

const corsOptions = {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
};
app.use(cors(corsOptions));
app.use(morgan(process.env.LOG_FORMAT || 'dev'));

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Graceful JSON parse error handler
 * - Catches body-parser JSON parse errors (entity.parse.failed)
 * - If content-type is NOT JSON, swallow the error and continue so urlencoded parser can handle it
 * - If content-type IS JSON and parse failed, return 400 with a helpful message
 * Place this AFTER express.json()/urlencoded() but BEFORE your routers.
 */
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    // Log concise info + original url
    console.warn('JSON parse failed for %s %s: %s', req.method, req.originalUrl, err.message);

    const ct = (req.headers['content-type'] || '').toLowerCase();
    const isJson = ct.indexOf('application/json') !== -1 || ct.indexOf('+json') !== -1;

    if (!isJson) {
      // If client didn't claim JSON, ignore parse error and continue.
      // Ensure req.body is at least an empty object so later code doesn't break.
      req.body = req.body || {};
      return next();
    }

    // If client did claim JSON, respond with 400 Bad Request and helpful JSON
    return res.status(400).json({ ok: false, error: 'invalid_json', message: err.message });
  }
  // Not a parse error — pass along
  next(err);
});

/**
 * CSP middleware (configurable via env CSP_CONNECT_SRC)
 * (Optional but useful for dev — adjust for production.)
 */
app.use((req, res, next) => {
  const connectSrcList = (process.env.CSP_CONNECT_SRC || "http://localhost:5001 'self'").trim();
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: https:",
    `connect-src ${connectSrcList}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});

/**
 * Session placeholder (if you use sessions)
 * Note: if you already configure sessions elsewhere, remove this or adapt.
 */
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';
app.use(session({
  name: process.env.SESSION_NAME || 'sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: (process.env.NODE_ENV === 'production'),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

/**
 * Mount routers BEFORE static serving to prevent returning index.html for broken API paths.
 * We will attempt to mount the commonly used routers and log mount status.
 */
const mounted = [];

/* ---- auth router (mounted under /api and /api/auth) ---- */
try {
  const authRouter = require('./src/routes/auth');
  app.use('/api', authRouter);
  app.use('/api/auth', authRouter);
  mounted.push('/api (auth), /api/auth (auth)');
  console.log('Mounted auth router at /api and /api/auth');
} catch (e) {
  console.error('auth router not mounted (full error):', e && e.stack ? e.stack : e);
}

/* ---- comments router ---- */
try {
  const commentsRouter = require('./src/routes/comments');
  app.use('/api/comments', commentsRouter);
  mounted.push('/api/comments');
  console.log('Mounted comments router at /api/comments');
} catch (e) {
  console.warn('comments router not mounted:', e && e.stack ? e.stack : e);
}

/* ---- search router (mounted under /api) ---- */
try {
  const searchRouter = require('./src/routes/search');
  app.use('/api', searchRouter);
  mounted.push('/api (search)');
  console.log('Mounted search router at /api');
} catch (e) {
  console.warn('search router not mounted:', e && e.stack ? e.stack : e);
}

/* ---- uploads router ---- */
try {
  const uploadsRouter = require('./src/routes/uploads');
  app.use('/api/uploads', uploadsRouter);
  mounted.push('/api/uploads');
  console.log('Mounted uploads router at /api/uploads');
} catch (e) {
  console.warn('uploads router not mounted:', e && e.stack ? e.stack : e);
}

/* ---- classSubjects router ---- */
try {
  const classSubjectsRouter = require('./src/routes/classSubjects');
  app.use('/api/classes', classSubjectsRouter);
  mounted.push('/api/classes');
  console.log('Mounted classSubjects router at /api/classes');
} catch (e) {
  console.warn('classSubjects router not mounted:', e && e.stack ? e.stack : e);
}

/* ---- admin router: try common locations and log stack trace on error ---- */
(() => {
  const tryPaths = [
    './src/routes/admin',  // existing app path
    './server/admin',      // single-file admin module (if you placed it here)
    './server/modules/admin/routes', // other suggested path
    './server/modules/admin', // possible index export
  ];
  let mountedAdmin = false;
  for (const p of tryPaths) {
    try {
      if (fs.existsSync(path.join(__dirname, p + '.js')) || fs.existsSync(path.join(__dirname, p))) {
        const adminRouter = require(p);
        app.use('/api/admin', adminRouter);
        mounted.push('/api/admin');
        console.log(`Mounted admin router from "${p}" at /api/admin`);
        mountedAdmin = true;
        break;
      }
    } catch (e) {
      console.error(`Failed to require admin router at "${p}":`, e && e.stack ? e.stack : e);
      // continue trying next path
    }
  }
  if (!mountedAdmin) {
    console.warn('admin router not mounted: none of the tried paths exist or loaded successfully:', tryPaths.join(', '));
  }
})();

console.log('Mounted routers:', mounted.length ? mounted.join(', ') : '(none)');

/**
 * Static public files (serve AFTER API routers are mounted)
 * This avoids accidentally serving index.html for API requests when a router is missing.
 */
const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  // Keep /uploads static if you store fallback uploads in public/uploads
  const uploadsStatic = path.join(PUBLIC_DIR, 'uploads');
  if (fs.existsSync(uploadsStatic)) {
    app.use('/uploads', express.static(uploadsStatic));
  }
  console.log('Serving static from', PUBLIC_DIR);
} else {
  console.warn('Warning: public directory not found:', PUBLIC_DIR);
}

/* -------------------------
   Health and info endpoints
   ------------------------- */
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString(), pid: process.pid, mounted });
});
app.get('/api/info', (req, res) => {
  res.json({
    ok: true,
    env: {
      node_env: process.env.NODE_ENV || 'development',
      database_url_set: !!process.env.DATABASE_URL,
      port: process.env.PORT || null
    },
    mounted
  });
});

/* API 404 handler for /api/* — keep before SPA fallback */
app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: `No ${req.method} ${req.originalUrl}` });
  }
  next();
});

/* SPA fallback — returns index.html for non-API routes */
app.get('*', (req, res) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not Found' });
  }
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Not Found');
});

/* Error handler */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

/* Start server */
const port = parseInt(process.env.PORT, 10) || 5001;
const server = app.listen(port, () => {
  console.log(`Server listening on port ${port} (pid=${process.pid})`);
});

/* Graceful shutdown */
function shutdown(signal) {
  console.log(`Received ${signal}, closing server...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      const db = require('./src/db');
      if (db && db.pool && typeof db.pool.end === 'function') {
        await db.pool.end();
        console.log('PG pool ended.');
      }
    } catch (e) { /* ignore */ }
    process.exit(0);
  });
  setTimeout(() => {
    console.warn('Forcing shutdown.');
    process.exit(1);
  }, 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;