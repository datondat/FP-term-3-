const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// In-memory demo user
const users = [
  { id: 1, username: 'teacher', passwordHash: bcrypt.hashSync('password123', 10), displayName: 'GV Demo' }
];

// Auth APIs
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, message: 'Thiếu username/password' });
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ ok: false, message: 'Sai tên hoặc mật khẩu' });
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ ok: false, message: 'Sai tên hoặc mật khẩu' });
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.displayName = user.displayName;
  res.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.displayName } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ ok: false });
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ ok: true, user: null });
  res.json({ ok: true, user: { id: req.session.userId, username: req.session.username, displayName: req.session.displayName } });
});

// Simple search demo
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const items = [
    { id: 'm1', title: 'Giải bài tập Toán 6 - Chương 1', class: 'Lớp 6' },
    { id: 'm2', title: 'Văn mẫu lớp 9 - Bài văn nghị luận', class: 'Lớp 9' },
    { id: 'm3', title: 'Bài tập Hóa lớp 11', class: 'Lớp 11' }
  ];
  const results = q ? items.filter(i => i.title.toLowerCase().includes(q) || i.class.toLowerCase().includes(q)) : items;
  res.json({ ok: true, results });
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});