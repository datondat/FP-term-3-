const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

// basic middleware
app.use(cors()); // in production restrict origin
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// serve static client (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// mount API routers
// auth router if exists
try {
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
} catch (e) {
  console.warn('Auth router not found or failed to load:', e.message || e);
}

// mount other API routers (drive, search, uploads, etc.) if present
// Drive router is expected at server/drive.js (relative). Mount under '/api' so endpoints become '/api/drive/...'
try {
  app.use('/api', require('../server/drive'));
} catch (e) {
  console.warn('Drive router not mounted (server/drive.js missing?):', e.message || e);
}

// mount other routers if exist (example: search, uploads)
try {
  const searchRouter = require('./routes/search');
  app.use('/api', searchRouter);
} catch (e) {}
try {
  const uploadsRouter = require('./routes/uploads');
  app.use('/api/uploads', uploadsRouter);
} catch (e) {}
try {
  const commentsRouter = require('./routes/comments');
  app.use('/api/comments', commentsRouter);
} catch (e) {}
try {
  const classSubjectsRouter = require('./routes/classSubjects');
  app.use('/api/classes', classSubjectsRouter);
} catch (e) {}
// ... you can mount other routers similarly

// health check
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// fallback to SPA: must be after API mounts
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));