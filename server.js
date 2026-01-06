'use strict';
/**
 * server.js
 * Entry point (full file).
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

// Serve public files (static) and uploads
const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));
} else {
  console.warn('Warning: public directory not found:', PUBLIC_DIR);
}

// Mount auth router EARLY under /api so endpoints /api/login etc work
const mounted = [];
try {
  const authRouter = require('./src/routes/auth');
  app.use('/api', authRouter);
  app.use('/api/auth', authRouter);
  mounted.push('/api (auth), /api/auth (auth)');
} catch (e) {
  console.error('auth router not mounted (full error):', e && e.stack ? e.stack : e);
}

// Other routers (comments, search, uploads, classSubjects, admin)...
try {
  const commentsRouter = require('./src/routes/comments');
  app.use('/api/comments', commentsRouter);
  mounted.push('/api/comments');
} catch (e) { console.warn('comments router not mounted:', e && e.message ? e.message : e); }
try {
  const searchRouter = require('./src/routes/search');
  app.use('/api', searchRouter);
  mounted.push('/api (search)');
} catch (e) { console.warn('search router not mounted:', e && e.message ? e.message : e); }
try {
  const uploadsRouter = require('./src/routes/uploads');
  app.use('/api/uploads', uploadsRouter);
  mounted.push('/api/uploads');
} catch (e) { console.warn('uploads router not mounted:', e && e.message ? e.message : e); }
try {
  const classSubjectsRouter = require('./src/routes/classSubjects');
  app.use('/api/classes', classSubjectsRouter);
  mounted.push('/api/classes');
} catch (e) { console.warn('classSubjects router not mounted:', e && e.message ? e.message : e); }
try {
  const adminRouter = require('./src/routes/admin');
  app.use('/api/admin', adminRouter);
  mounted.push('/api/admin');
} catch (e) { console.warn('admin router not mounted:', e && e.message ? e.message : e); }

console.log('Mounted routers:', mounted.length ? mounted.join(', ') : '(none)');

// health endpoints...
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString(), pid: process.pid, mounted });
});
app.get('/api/info', (req, res) => {
  res.json({ ok: true, env: { node_env: process.env.NODE_ENV || 'development', database_url_set: !!process.env.DATABASE_URL, port: process.env.PORT || null }, mounted });
});

// API 404 handler for /api/*
app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: `No ${req.method} ${req.originalUrl}` });
  }
  next();
});

// SPA fallback...
app.get('*', (req, res) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not Found' });
  }
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Not Found');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

const port = parseInt(process.env.PORT, 10) || 5001;
const server = app.listen(port, () => {
  console.log(`Server listening on port ${port} (pid=${process.pid})`);
});

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