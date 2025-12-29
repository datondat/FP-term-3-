const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

// middleware
app.use(cors()); // trong production hãy giới hạn origin
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// serve static client (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// mount auth router nếu bạn có (nếu không có router này, try/catch sẽ bỏ qua)
try {
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
} catch (e) {
  console.warn('Auth router not found or failed to load:', e.message || e);
}

// mount drive router: server/drive.js exports '/drive/...' routes, so mounting under '/api' gives '/api/drive/...'
try {
  app.use('/api', require('../server/drive'));
} catch (e) {
  console.error('Failed to mount drive router:', e);
}

// health check
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));