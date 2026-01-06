const express = require('express');
const path = require('path');
const cors = require('cors');
const getRawBody = require('raw-body');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

// TEMP: Log mọi request để debug (bỏ sau khi fix)
app.use((req, res, next) => {
  console.log('>>> REQ', req.method, req.originalUrl, 'ct=', req.headers['content-type'] || '');
  next();
});

// --- DEBUG RAW BODY ROUTE ---
// Must be placed BEFORE app.use(express.json()) so body-parser doesn't try to parse first.
// This route will return the exact bytes the server receives.
app.post('/api/debug-raw', async (req, res) => {
  try {
    const len = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : undefined;
    const buf = await getRawBody(req, { length: len, limit: '1mb' });
    const str = buf ? buf.toString('utf8') : '';
    return res.json({ ok: true, raw: str, length: buf ? buf.length : 0, headers: req.headers });
  } catch (err) {
    console.error('debug-raw read error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
});
// --- END DEBUG RAW BODY ROUTE ---

// basic middleware
app.use(cors()); // in production restrict origin

// Now install body parsers (after debug route)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// JSON parse error handler: return JSON 400 instead of HTML stacktrace
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    const isJson = ct.indexOf('application/json') !== -1 || ct.indexOf('+json') !== -1;
    console.warn('JSON parse failed for', req.method, req.originalUrl, 'isJson=', isJson, 'err=', err.message);
    if (!isJson) {
      req.body = req.body || {};
      return next();
    }
    return res.status(400).json({ ok: false, error: 'invalid_json', message: err.message });
  }
  next(err);
});

// serve static client (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// mount API routers
// auth router -> mount under /api so routes become /api/login, /api/register, /api/logout, /api/me
try {
  const authRouter = require('./routes/auth');
  app.use('/api', authRouter);
  console.log('Auth router mounted at /api');
} catch (e) {
  console.warn('Auth router not found or failed to load:', e.message || e);
}

// mount other API routers (drive, search, uploads, etc.) if present
try {
  app.use('/api', require('../server/drive'));
  console.log('Drive router mounted at /api');
} catch (e) {
  console.warn('Drive router not mounted (server/drive.js missing?):', e.message || e);
}

try {
  const searchRouter = require('./routes/search');
  app.use('/api', searchRouter);
  console.log('Search router mounted at /api');
} catch (e) {}
try {
  const uploadsRouter = require('./routes/uploads');
  app.use('/api/uploads', uploadsRouter);
  console.log('Uploads router mounted at /api/uploads');
} catch (e) {}
try {
  const commentsRouter = require('./routes/comments');
  app.use('/api/comments', commentsRouter);
  console.log('Comments router mounted at /api/comments');
} catch (e) {}
try {
  const classSubjectsRouter = require('./routes/classSubjects');
  app.use('/api/classes', classSubjectsRouter);
  console.log('Classes router mounted at /api/classes');
} catch (e) {}

// API health / ping (useful for tests)
app.get('/api/ping', (_req, res) => res.json({ ok: true, now: new Date().toISOString() }));

// health check (generic)
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// fallback to SPA: must be after API mounts
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));