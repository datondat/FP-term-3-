// server.js (patched to mount uploads & classSubjects routes)
'use strict';
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
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
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));
} else {
  console.warn('Warning: public directory not found:', PUBLIC_DIR);
}

const mounted = [];
try {
  const authRouter = require('./src/routes/auth');
  app.use('/api/auth', authRouter);
  mounted.push('/api/auth');
} catch (e) {
  console.warn('auth router not mounted:', e.message);
}
try {
  const commentsRouter = require('./src/routes/comments');
  app.use('/api/comments', commentsRouter);
  mounted.push('/api/comments');
} catch (e) {
  console.warn('comments router not mounted:', e.message);
}
try {
  const searchRouter = require('./src/routes/search');
  app.use('/api', searchRouter);
  mounted.push('/api (search)');
} catch (e) {
  console.warn('search router not mounted:', e.message);
}

// mount uploads router (optional — will fail silently if file missing)
try {
  const uploadsRouter = require('./src/routes/uploads');
  app.use('/api/uploads', uploadsRouter);
  mounted.push('/api/uploads');
} catch (e) {
  console.warn('uploads router not mounted:', e.message);
}

// mount classSubjects router
try {
  const classSubjectsRouter = require('./src/routes/classSubjects');
  app.use('/api/classes', classSubjectsRouter);
  mounted.push('/api/classes');
} catch (e) {
  console.warn('classSubjects router not mounted:', e.message);
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

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: `No ${req.method} ${req.originalUrl}` });
  }
  next();
});

app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not Found' });
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Not Found');
});

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
    } catch (e) { }
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