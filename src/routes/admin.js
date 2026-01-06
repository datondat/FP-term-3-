'use strict';
/**
 * src/routes/admin.js
 * Admin-only endpoints:
 *  GET  /api/admin/uploads
 *  POST /api/admin/upload       (multipart/form-data, field "file")
 *  GET  /api/admin/comments
 *  PATCH /api/admin/comments/:id  (body { approved: true|false })
 *  DELETE /api/admin/comments/:id
 *
 * Requirements:
 * - src/db exports { pool } (pg Pool)
 * - express-session is configured in main app and req.session.userId is set on login
 * - public/uploads is served statically by server
 * - npm install multer
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();
const { pool } = require('../db'); // ensure this exists

// Accept JSON/urlencoded bodies where needed
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Admin check middleware
async function ensureAdmin(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ ok: false, error: 'not_authenticated' });
    }
    const r = await pool.query('SELECT id, username, role FROM users WHERE id = $1 LIMIT 1', [req.session.userId]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ ok: false, error: 'not_authenticated' });
    if (user.role !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
    req.user = user;
    next();
  } catch (err) {
    console.error('ensureAdmin error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

// Setup upload directory
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) { console.warn('Could not create uploads dir', e); }
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // generate unique filename: timestamp-random-original
    const ext = path.extname(file.originalname || '');
    const base = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    cb(null, base + ext);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// ---------- Admin routes ----------

// List uploads
router.get('/uploads', ensureAdmin, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, filename, original_name, mimetype, size, path, uploaded_by, created_at FROM uploads ORDER BY created_at DESC');
    return res.json({ ok: true, uploads: r.rows });
  } catch (err) {
    console.error('GET /admin/uploads error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Upload file (multipart/form-data, field name 'file')
router.post('/upload', ensureAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'no_file' });
    const relPath = path.posix.join('/uploads', req.file.filename);
    const sql = `
      INSERT INTO uploads (filename, original_name, mimetype, size, path, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, filename, original_name, mimetype, size, path, uploaded_by, created_at
    `;
    const values = [req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, relPath, req.user.id];
    const r = await pool.query(sql, values);
    return res.json({ ok: true, file: r.rows[0] });
  } catch (err) {
    console.error('POST /admin/upload error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// List comments
router.get('/comments', ensureAdmin, async (req, res) => {
  try {
    const r = await pool.query(`SELECT c.id, c.user_id, u.username, c.content, c.approved, c.created_at
                                FROM comments c LEFT JOIN users u ON u.id = c.user_id
                                ORDER BY c.created_at DESC`);
    return res.json({ ok: true, comments: r.rows });
  } catch (err) {
    console.error('GET /admin/comments error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Approve/unapprove comment
router.patch('/comments/:id', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { approved } = req.body;
    if (typeof approved !== 'boolean') return res.status(400).json({ ok: false, error: 'approved_boolean_required' });
    const r = await pool.query('UPDATE comments SET approved = $1 WHERE id = $2 RETURNING id, approved', [approved, id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, comment: r.rows[0] });
  } catch (err) {
    console.error('PATCH /admin/comments/:id error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Delete comment
router.delete('/comments/:id', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query('DELETE FROM comments WHERE id = $1 RETURNING id', [id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, deleted: r.rows[0].id });
  } catch (err) {
    console.error('DELETE /admin/comments/:id error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;