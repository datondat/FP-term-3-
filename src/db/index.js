// src/index.js
// Server entry that mounts routes from src/routes and serves static files from src/public
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// parse json/form
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// mount your existing routes folder (the files you showed in screenshot)
const authRoutes = require('./routes/auth');
const assignmentsRoutes = require('./routes/assignments');
const classSubjectsRoutes = require('./routes/classSubjects');
const commentsRoutes = require('./routes/comments');
const searchRoutes = require('./routes/search');
const submissionsRoutes = require('./routes/submissions');
const uploadsRoutes = require('./routes/uploads');
// mount as needed; adjust base paths if your route files export differently
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/subjects', classSubjectsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/uploads', uploadsRoutes);

// serve static files: use src/public if your assets are under src/public (per screenshot)
const staticPath = path.join(__dirname, 'public');
app.use(express.static(staticPath));

// optional: return index.html for client-side routes (SPA fallback)
app.get('*', (req, res) => {
  // if request accepts HTML, return index.html; else 404 JSON
  if (req.method === 'GET' && req.accepts('html')) {
    return res.sendFile(path.join(staticPath, 'index.html'), (err) => {
      if (err) res.status(500).send('Server error');
    });
  }
  res.status(404).json({ error: 'Not found' });
});

// error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});