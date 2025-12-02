const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Enable CORS (allow frontend dev server to call backend)
app.use(cors());

// Logging: concise http request logger
app.use(morgan('dev'));

// parse JSON bodies (for non-multipart routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from public (if you use the backend to serve the static page)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname,'public','uploads')));

// Fake auth for development (replace with real auth middleware)
app.use((req, res, next) => {
  // You can change this user for testing different roles
  req.user = { id: 1, role: 'teacher', display_name: 'Giáo viên A' };
  next();
});

// Mount routers
const assignmentsRouter = require('./src/routes/assignments');
const submissionsRouter = require('./src/routes/submissions');
app.use('/api/assignments', assignmentsRouter);
app.use('/api/submissions', submissionsRouter);

// Catch-all for unmatched routes -> return JSON 404 to make it obvious
app.use((req, res, next) => {
  console.log('No matching route for:', req.method, req.originalUrl);
  // If it's an API path return JSON, else fallback to index.html if SPA, or 404 JSON
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok:false, error: `No ${req.method} ${req.originalUrl}` });
  }
  // If you use SPA, uncomment the next line to serve index.html
  // res.sendFile(path.join(__dirname, 'public', 'index.html'));
  res.status(404).send('Not Found');
});

const port = process.env.PORT || 5000;
app.listen(port, ()=> console.log(`Server run on ${port}`));