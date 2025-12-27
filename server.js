'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

console.log('==== Starting server ====');
console.log('File:', __filename);
console.log('CWD :', process.cwd());
console.log('PID :', process.pid);
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION', err && err.stack ? err.stack : err);
  // Graceful exit
  process.exit(1);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('UNHANDLED REJECTION at Promise', p, 'reason:', reason);
  // Optionally exit or keep running; here we exit to avoid unknown state
  process.exit(1);
});

// Optional CORS middleware
try {
  const cors = require('cors');
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
  };
  app.use(cors(corsOptions));
  console.log('CORS enabled');
} catch (e) {
  console.log('CORS not available (optional)');
}

// Optional Morgan logging
try {
  const morgan = require('morgan');
  app.use(morgan(process.env.LOG_FORMAT || 'dev'));
  console.log('Morgan logging enabled');
} catch (e) {
  console.log('Morgan not available (optional)');
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  const uploadsDir = path.join(PUBLIC_DIR, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    app.use('/uploads', express.static(uploadsDir));
  }
} else {
  console.warn('Warning: public directory not found:', PUBLIC_DIR);
}

function tryMount(modulePath, mountPoint, description) {
  try {
    const mod = require(modulePath);
    // If module exports a function that accepts (app) -> register itself
    if (typeof mod === 'function' && mod.length >= 1) {
      // treat as register(app) function
      mod(app);
      console.log(`Mounted ${description || modulePath} via register(app)`);
      return mountPoint;
    }
    // If exports an express Router or app-like (has 'use' and 'route' etc)
    if (mod && (typeof mod === 'object') && (typeof mod.use === 'function' || typeof mod.handle === 'function' || mod.stack)) {
      app.use(mountPoint, mod);
      console.log(`Mounted ${description || modulePath} at ${mountPoint}`);
      return mountPoint;
    }
    // If exports directly a Router-like (function) -> mount it
    if (typeof mod === 'function') {
      app.use(mountPoint, mod);
      console.log(`Mounted ${description || modulePath} (callable) at ${mountPoint}`);
      return mountPoint;
    }
    console.warn(`Module ${modulePath} loaded but not mountable (unexpected export).`);
    return null;
  } catch (e) {
    console.warn(`${description || modulePath} not mounted: ${e && e.message ? e.message : e}`);
    return null;
  }
}

const mounted = [];

// Mount known routers (these require files in your src/ directory)
const mounts = [
  { path: './src/routes/auth', mount: '/api/auth', desc: 'auth router' },
  { path: './src/routes/comments', mount: '/api/comments', desc: 'comments router' },
  { path: './src/routes/search', mount: '/api', desc: 'search router' },
  { path: './src/routes/uploads', mount: '/api/uploads', desc: 'uploads router' },
  { path: './src/routes/classSubjects', mount: '/api/classes', desc: 'classSubjects router' },
  // drive-proxy may export a router or a register function; try mounting at /api (it should not call listen())
  { path: './src/drive-proxy', mount: '/api', desc: 'drive-proxy' }
];

for (const m of mounts) {
  const ok = tryMount(m.path, m.mount, m.desc);
  if (ok) mounted.push(ok);
}

console.log('Mounted routers:', mounted.length ? mounted.join(', ') : '(none)');

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

// If request path starts with /api and no route matched, return JSON 404
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: `No ${req.method} ${req.originalUrl}` });
  }
  next();
});

// Serve SPA index.html for non-API routes
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not Found' });
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Not Found');
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

// Start server
const port = parseInt(process.env.PORT, 10) || 5001;
const server = app.listen(port, () => {
  console.log(`Server listening on port ${port} (pid=${process.pid})`);
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, closing server...`);
  server.close(async (err) => {
    if (err) console.error('Error closing server:', err);
    else console.log('HTTP server closed.');
    try {
      const db = require('./src/db');
      if (db && db.pool && typeof db.pool.end === 'function') {
        await db.pool.end();
        console.log('PG pool ended.');
      }
    } catch (e) {
      // ignore
    }
    process.exit(err ? 1 : 0);
  });
  // Force after timeout
  setTimeout(() => {
    console.warn('Forcing shutdown.');
    process.exit(1);
  }, 10000).unref();
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = app;