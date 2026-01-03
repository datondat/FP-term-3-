'use strict';
/**
 * server.js
 * Entry point (full file). Includes:
 * - cors, morgan, body parsers
 * - express-session (must come BEFORE mounting API routes that use req.session)
 * - mounts auth router (at /api and /api/auth) BEFORE other /api routers to ensure /api/login etc work
 * - serves static from /public, /uploads
 * - API 404 handler for unknown /api routes
 * - SPA fallback for non-API routes
 *
 * Replace your existing server.js with this file and restart the app.
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
 * Session middleware
 * MUST be before mounting API routes that rely on req.session.
 * In production, replace the default MemoryStore with a persistent store (redis/connect-pg).
 */
app.use(session({
  name: process.env.SESSION_NAME || 'connect.sid',
  secret: process.env.SESSION_SECRET || 'replace-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE || 'lax', // 'lax' is safe for most
    secure: (process.env.NODE_ENV === 'production'), // secure cookies in prod (HTTPS)
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Serve public files (static) and uploads
const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));
} else {
  console.warn('Warning: public directory not found:', PUBLIC_DIR);
}

// Mount auth router EARLY under /api so endpoints /api/login, /api/logout, /api/me work
const mounted = [];
try {
  const authRouter = require('./src/routes/auth');
  // Mount at both /api and /api/auth for compatibility
  app.use('/api', authRouter);
  app.use('/api/auth', authRouter);
  mounted.push('/api (auth), /api/auth (auth)');
} catch (e) {
  console.warn('auth router not mounted:', e && e.message ? e.message : e);
}

// Other routers (mount after auth so auth routes take precedence)
try {
  const commentsRouter = require('./src/routes/comments');
  app.use('/api/comments', commentsRouter);
  mounted.push('/api/comments');
} catch (e) {
  console.warn('comments router not mounted:', e && e.message ? e.message : e);
}
try {
  const searchRouter = require('./src/routes/search');
  app.use('/api', searchRouter); // search endpoints under /api/*
  mounted.push('/api (search)');
} catch (e) {
  console.warn('search router not mounted:', e && e.message ? e.message : e);
}

// uploads router (optional)
try {
  const uploadsRouter = require('./src/routes/uploads');
  app.use('/api/uploads', uploadsRouter);
  mounted.push('/api/uploads');
} catch (e) {
  console.warn('uploads router not mounted:', e && e.message ? e.message : e);
}

// classSubjects router
try {
  const classSubjectsRouter = require('./src/routes/classSubjects');
  app.use('/api/classes', classSubjectsRouter);
  mounted.push('/api/classes');
} catch (e) {
  console.warn('classSubjects router not mounted:', e && e.message ? e.message : e);
}

console.log('Mounted routers:', mounted.length ? mounted.join(', ') : '(none)');

// Lightweight health endpoints
app.get('/api/ping', (req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString(),
    pid: process.pid,
    mounted
  });
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

/**
 * If a request starts with /api/ and no route matched, return JSON 404 here.
 * This prevents SPA fallback from returning index.html for API calls.
 */
app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: `No ${req.method} ${req.originalUrl}` });
  }
  next();
});

/**
 * SPA fallback - serve index.html for non-API routes
 */
app.get('*', (req, res) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not Found' });
  }
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Not Found');
});

/**
 * Error handler
 */
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

// export app for tests
module.exports = app;