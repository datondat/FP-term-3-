// server.js - static + multi-source search + PostgreSQL auth & comments
// After copying: npm install fuse.js pg bcrypt jsonwebtoken
// Optional: npm install better-sqlite3
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const fs = require('fs');
let Fuse;
try { Fuse = require('fuse.js'); } catch (e) { console.warn('Fuse.js not installed.'); }

const { pool } = require('./src/db');
const authRouter = require('./src/routes/auth');
const commentsRouter = require('./src/routes/comments');

const app = express();

console.log('Starting server from file:', __filename);
console.log('Process PID:', process.pid);

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Fake auth for development convenience (kept for compatibility)
app.use((req, res, next) => {
  // If you want to disable fake user, comment next line.
  // req.user = { id: 1, role: 'teacher', display_name: 'Giáo viên A' };
  next();
});

// Mount API routers
app.use('/api/auth', authRouter);
app.use('/api/comments', commentsRouter);

// --- Multi-source indexing (now supports Postgres materials table) ---
let materials = [];
let fuse = null;

function normalizeItem(it, source = 'unknown') {
  return {
    id: it.id || it.name || it.url || `${source}:${Math.random().toString(36).slice(2,9)}`,
    title: it.title || it.name || path.basename(it.url || it.path || '', path.extname(it.url || it.path || '')) || '(Không có tiêu đề)',
    subject: it.subject || it.category || '',
    tags: it.tags || [],
    content: it.content || it.description || '',
    url: it.url || it.path || null,
    _source: source
  };
}

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full, fileList);
    else fileList.push(full);
  }
  return fileList;
}

function loadFromJsons() {
  const dbDir = path.join(__dirname, 'db');
  const results = [];
  if (!fs.existsSync(dbDir)) return results;
  const files = fs.readdirSync(dbDir);
  for (const f of files) {
    if (!f.toLowerCase().endsWith('.json')) continue;
    const full = path.join(dbDir, f);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach(p => results.push(normalizeItem(p, `json:${f}`)));
      else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.items)) parsed.items.forEach(p => results.push(normalizeItem(p, `json:${f}`)));
        else results.push(normalizeItem(parsed, `json:${f}`));
      }
    } catch (err) {
      console.warn('Failed parse json', full, err.message);
    }
  }
  return results;
}

function loadFromUploads() {
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  const out = [];
  if (!fs.existsSync(uploadsDir)) return out;
  const files = walkDir(uploadsDir);
  for (const full of files) {
    const rel = path.relative(path.join(__dirname, 'public'), full).split(path.sep).join('/');
    const url = '/' + rel;
    const title = path.basename(full, path.extname(full));
    const subject = path.basename(path.dirname(full));
    out.push(normalizeItem({ title, subject, url, path: url }, 'uploads'));
  }
  return out;
}

// Load from Postgres table 'materials' if exists
async function loadFromPostgres() {
  const out = [];
  try {
    const client = await pool.connect();
    try {
      // Check table exists
      const r = await client.query(`
        SELECT to_regclass('public.materials') as t
      `);
      if (!r.rows[0] || !r.rows[0].t) {
        // no materials table
        return out;
      }
      // Select columns we expect (title, subject, content, tags, url, id)
      const rows = await client.query('SELECT id, title, subject, content, tags, url FROM materials LIMIT 1000');
      for (const row of rows.rows) {
        let tags = [];
        if (row.tags) {
          if (Array.isArray(row.tags)) tags = row.tags;
          else if (typeof row.tags === 'string') {
            try { tags = JSON.parse(row.tags); } catch (e) { tags = row.tags.split(',').map(s => s.trim()); }
          }
        }
        out.push(normalizeItem({
          id: row.id,
          title: row.title,
          subject: row.subject,
          content: row.content,
          tags,
          url: row.url
        }, 'postgres:materials'));
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('Postgres load failed', err.message);
  }
  return out;
}

async function buildIndex() {
  const items = [];
  // load JSON files
  items.push(...loadFromJsons());
  // uploads
  items.push(...loadFromUploads());
  // postgres materials (async)
  const pgItems = await loadFromPostgres();
  items.push(...pgItems);

  // dedupe
  const seen = new Map();
  for (const it of items) {
    const key = it.id || it.url || (it.title + '|' + it.subject);
    if (!seen.has(key)) seen.set(key, it);
  }
  materials = Array.from(seen.values());

  if (Fuse && materials.length) {
    fuse = new Fuse(materials, {
      keys: [
        { name: 'title', weight: 0.7 },
        { name: 'subject', weight: 0.15 },
        { name: 'tags', weight: 0.1 },
        { name: 'content', weight: 0.05 }
      ],
      includeScore: true,
      threshold: 0.45,
      ignoreLocation: true,
      findAllMatches: false
    });
  } else {
    fuse = null;
  }
  console.log(`Index built: ${materials.length} items (Fuse ${fuse ? 'enabled' : 'disabled'})`);
}

// build at startup
buildIndex().catch(err => console.warn('Initial buildIndex error', err));

// reindex endpoint
app.post('/api/reindex', async (req, res) => {
  try {
    await buildIndex();
    res.json({ ok: true, total: materials.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// simple ping
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString(), totalIndexed: materials.length });
});

// /api/search uses fuse if available otherwise substring on materials
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = Math.min(50, Math.max(5, parseInt(req.query.limit || '10', 10)));
  if (!q) return res.json({ total: 0, page, perPage, results: [] });
  if (!materials || materials.length === 0) return res.json({ total: 0, page, perPage, results: [] });

  if (fuse) {
    const raw = fuse.search(q);
    const total = raw.length;
    const start = (page - 1) * perPage;
    const slice = raw.slice(start, start + perPage).map(r => ({ score: r.score, item: r.item }));
    return res.json({ total, page, perPage, results: slice });
  }

  const low = q.toLowerCase();
  const matched = materials.filter(m =>
    (m.title && m.title.toLowerCase().includes(low)) ||
    (m.subject && m.subject.toLowerCase().includes(low)) ||
    (Array.isArray(m.tags) && m.tags.join(' ').toLowerCase().includes(low)) ||
    (m.content && m.content.toLowerCase().includes(low))
  ).map(it => ({ score: 0, item: it }));
  const total = matched.length;
  const start = (page - 1) * perPage;
  const paged = matched.slice(start, start + perPage);
  res.json({ total, page, perPage, results: paged });
});

// /api/suggest
app.get('/api/suggest', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ suggestions: [] });
  let items = [];
  if (fuse) items = fuse.search(q).slice(0, 8).map(r => r.item);
  else {
    const low = q.toLowerCase();
    items = materials.filter(m => (m.title && m.title.toLowerCase().includes(low)) || (m.subject && m.subject.toLowerCase().includes(low))).slice(0, 8);
  }
  const suggestions = items.map(it => ({ id: it.id, title: it.title, subject: it.subject, tags: it.tags, url: it.url }));
  res.json({ suggestions });
});

// Fallback for other /api routes
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: `No ${req.method} ${req.originalUrl}` });
  }
  res.status(404).send('Not Found');
});

const port = parseInt(process.env.PORT, 10) || 5001;
app.listen(port, () => console.log(`Server running on ${port} (pid=${process.pid})`));