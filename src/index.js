const express = require('express');
const path = require('path');
const cors = require('cors');
const rawBody = require('raw-body');
const cookieSession = require('cookie-session');

const { pool } = require('./db'); // remains used by auth/other modules

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

// TEMP: Log mọi request để debug (bỏ sau khi ổn định)
app.use((req, res, next) => {
  console.log('>>> REQ', req.method, req.originalUrl, 'ct=', req.headers['content-type'] || '');
  next();
});

// --- DEBUG RAW BODY ROUTE (tạm, có thể xóa) ---
app.post('/api/debug-raw', async (req, res) => {
  try {
    const len = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : undefined;
    const buf = await rawBody(req, { length: len, limit: '1mb' });
    const str = buf ? buf.toString('utf8') : '';
    return res.json({ ok: true, raw: str, length: buf ? buf.length : 0, headers: req.headers });
  } catch (err) {
    console.error('debug-raw read error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
});
// --- END DEBUG RAW BODY ROUTE ---

// CORS: allow credentials (needed if frontend runs on different origin)
app.use(cors({
  origin: (origin, cb) => {
    // Allow any origin for dev. Replace with specific origin in production.
    cb(null, true);
  },
  credentials: true
}));

// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// COOKIE-BASED SESSION (no DB schema required)
// Note: cookie-session stores session data in a signed cookie. Good for small session payloads like userId.
const sessionName = process.env.SESSION_NAME || 'connect.sid';
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-this';
const cookieSameSite = process.env.SESSION_SAMESITE || 'lax'; // 'lax' | 'strict' | 'none'
const cookieSecure = (process.env.SESSION_SECURE === 'true') || (process.env.NODE_ENV === 'production');

app.use(cookieSession({
  name: sessionName,
  keys: [sessionSecret],
  // options:
  maxAge: 24 * 60 * 60 * 1000, // 1 day
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite
}));

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
try {
  const authRouter = require('./routes/auth');
  app.use('/api', authRouter);
  console.log('Auth router mounted at /api');
} catch (e) {
  console.warn('Auth router not found or failed to load:', e.message || e);
}

// optionally mount other routers (drive may require googleapis)
try {
  app.use('/api', require('../server/drive'));
  console.log('Drive router mounted at /api');
} catch (e) {
  console.warn('Drive router not mounted (server/drive.js missing or dependency error?):', e.message || e);
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

/**
 * IMPORTANT: Mount admin router (if exists) and add API 404 handler
 * We add the admin router now so /api/admin/* is served by it (if present).
 * Also ensure that any /api/* not matched by routers returns JSON 404,
 * not the SPA index.html.
 */
try {
  const adminRouter = require('./routes/admin');
  app.use('/api/admin', adminRouter);
  console.log('Admin router mounted at /api/admin');
} catch (e) {
  console.warn('Admin router not mounted (./routes/admin):', e && (e.message || e));
}

// API 404 handler: ensure /api/* that don't match route return JSON 404 (avoid SPA HTML)
app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: `No ${req.method} ${req.originalUrl}` });
  }
  next();
});

// fallback to SPA: must be after API mounts
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));