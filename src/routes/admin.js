'use strict';
/**
 * src/routes/admin.js
 * Admin-only endpoints:
 *  GET  /api/admin/uploads
 *  POST /api/admin/uploads       (multipart/form-data, field "file", optional fields: grade, subject)
 *  GET  /api/admin/comments
 *  PATCH /api/admin/comments/:id  (body { approved: true|false })
 *  PATCH /api/admin/comments     (body { ids: [...], approved: true|false })  <-- batch
 *  POST /api/admin/comments/:id/approve  (shim for client)
 *  DELETE /api/admin/comments/:id
 *  GET  /api/admin/users
 *  POST /api/admin/users/:id/role
 *  DELETE /api/admin/users/:id
 *
 * Drive support:
 *  If GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_KEY is provided
 *  and DRIVE_UPLOAD_FOLDER_ID is set, POST /uploads will try to upload file to Drive
 *  under DRIVE_UPLOAD_FOLDER_ID / <grade folder> / <subject folder>.
 *
 * Requirements:
 * - src/db exports { pool } (pg Pool)
 * - express-session is configured in main app and req.session.userId is set on login
 * - public/uploads is served statically by server (fallback local storage)
 * - npm install multer googleapis
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
    // DEBUG: log session contents to help diagnose auth issues
    console.log('ensureAdmin session:', req.session);

    // adjust this if your session stores user differently
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
    console.error('ensureAdmin error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error', message: (err && err.message) ? err.message : String(err), stack: err && err.stack ? err.stack : null });
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

/* ================= GOOGLE DRIVE HELPERS (optional) ================= */
let driveClient = null;
let googleAuth = null;
let DRIVE_ENABLED = false;
const DRIVE_ROOT_FOLDER = process.env.DRIVE_UPLOAD_FOLDER_ID || null;

function initDriveIfPossible() {
  if (driveClient) return driveClient;
  try {
    const { google } = require('googleapis');
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyPath && !keyJson) {
      DRIVE_ENABLED = false;
      return null;
    }
    if (keyPath && fs.existsSync(keyPath)) {
      googleAuth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    } else if (keyJson) {
      // write temp key file once per process
      const os = require('os');
      const tmp = path.join(os.tmpdir(), `gp-key-${process.pid}.json`);
      try { fs.writeFileSync(tmp, keyJson, { encoding: 'utf8' }); } catch(e){}
      googleAuth = new google.auth.GoogleAuth({
        keyFile: tmp,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    } else {
      DRIVE_ENABLED = false;
      return null;
    }
    driveClient = google.drive({ version: 'v3', auth: googleAuth });
    DRIVE_ENABLED = !!driveClient;
    return driveClient;
  } catch (e) {
    console.warn('Drive init failed:', e && e.message ? e.message : e);
    DRIVE_ENABLED = false;
    return null;
  }
}

async function findFolderByNameUnder(parentId, name) {
  const drive = initDriveIfPossible();
  if (!drive) return null;
  const qParts = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    `'${parentId}' in parents`,
    `name = '${name.replace(/'/g,"\\'")}'`,
    `trashed = false`
  ];
  const q = qParts.join(' and ');
  const res = await drive.files.list({ q, pageSize: 10, fields: 'files(id,name)' });
  if (res.data && Array.isArray(res.data.files) && res.data.files.length) return res.data.files[0];
  return null;
}

async function createFolder(name, parentId) {
  const drive = initDriveIfPossible();
  if (!drive) throw new Error('Drive not initialized');
  const fileMetadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined
  };
  const resp = await drive.files.create({ requestBody: fileMetadata, fields: 'id,name' });
  return resp.data;
}

async function findOrCreateFolderRecursive(grade, subject) {
  const drive = initDriveIfPossible();
  if (!drive) return null;
  let parent = DRIVE_ROOT_FOLDER || null;
  // normalize grade name, try variants
  const gradeNames = [];
  if (grade) {
    gradeNames.push(`lớp ${grade}`);
    gradeNames.push(`lop ${grade}`);
    gradeNames.push(`lớp${grade}`);
    gradeNames.push(`${grade}`);
  }
  // find grade folder under root
  let gradeFolder = null;
  if (parent) {
    for (const gname of gradeNames) {
      const found = await findFolderByNameUnder(parent, gname);
      if (found) { gradeFolder = found; break; }
    }
    if (!gradeFolder && grade) {
      // create folder with first candidate
      gradeFolder = await createFolder(`Lớp ${grade}`, parent);
    }
  } else {
    // no designated root, create top-level grade folder
    if (grade) gradeFolder = await createFolder(`Lớp ${grade}`, null);
  }

  if (!subject) return gradeFolder ? gradeFolder.id : parent;

  // find or create subject under gradeFolder (or parent)
  const parentForSubject = gradeFolder ? gradeFolder.id : parent;
  if (!parentForSubject) {
    // create subject at root
    const subj = await createFolder(subject, null);
    return subj.id;
  }
  // try find
  let subjectFolder = await findFolderByNameUnder(parentForSubject, subject);
  if (!subjectFolder) {
    // try normalized names
    const normalized = subject.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    subjectFolder = await findFolderByNameUnder(parentForSubject, normalized);
  }
  if (!subjectFolder) {
    subjectFolder = await createFolder(subject, parentForSubject);
  }
  return subjectFolder ? subjectFolder.id : null;
}

async function uploadFileToDriveLocal(filepath, filename, mimeType, parentId) {
  const drive = initDriveIfPossible();
  if (!drive) throw new Error('Drive not initialized');
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: parentId ? [parentId] : undefined,
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: fs.createReadStream(filepath),
    },
    fields: 'id,name,size,createdTime,mimeType,webViewLink'
  });
  return res.data;
}

/* ========================= ROUTES ========================= */

// List uploads
router.get('/uploads', ensureAdmin, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, filename, original_name, mimetype, size, path, uploaded_by, created_at FROM uploads ORDER BY created_at DESC');
    return res.json({ ok: true, uploads: r.rows });
  } catch (err) {
    console.error('GET /admin/uploads error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * POST /uploads
 * - multipart form: field 'file' (required)
 * - optional text fields: grade, subject
 * Behavior:
 *  - If Drive is configured (initDriveIfPossible() and DRIVE_ROOT_FOLDER set), attempt Drive upload into folder for grade/subject.
 *  - Otherwise fallback to saving file locally (already saved by multer into UPLOAD_DIR) and insert DB record.
 * DB insertion columns: filename, original_name, mimetype, size, path, uploaded_by
 * For Drive upload we set path = 'drive:<fileId>'
 */
router.post('/uploads', ensureAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'no_file' });

    const grade = (req.body && req.body.grade) ? String(req.body.grade).trim() : null;
    const subject = (req.body && req.body.subject) ? String(req.body.subject).trim() : null;

    // Attempt Drive upload if available
    let driveInfo = null;
    try {
      if (initDriveIfPossible() && DRIVE_ROOT_FOLDER) {
        const targetFolderId = await findOrCreateFolderRecursive(grade, subject);
        if (targetFolderId) {
          driveInfo = await uploadFileToDriveLocal(req.file.path, req.file.originalname || req.file.filename, req.file.mimetype, targetFolderId);
          // remove local temp file after successful drive upload
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
      }
    } catch (driveErr) {
      console.warn('Drive upload failed, falling back to local storage:', driveErr && driveErr.message ? driveErr.message : driveErr);
      driveInfo = null;
    }

    // Prepare DB insert values
    let pathValue = path.posix.join('/uploads', req.file.filename); // default local path
    let sizeVal = req.file.size;
    let mimeVal = req.file.mimetype;
    if (driveInfo && driveInfo.id) {
      pathValue = `drive:${driveInfo.id}`;
      // size may be in driveInfo.size (string) convert to number if present
      sizeVal = driveInfo.size ? Number(driveInfo.size) : null;
      mimeVal = driveInfo.mimeType || mimeVal;
    }

    const sql = `
      INSERT INTO uploads (filename, original_name, mimetype, size, path, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, filename, original_name, mimetype, size, path, uploaded_by, created_at
    `;
    const values = [req.file.filename, req.file.originalname, mimeVal, sizeVal, pathValue, req.user.id];
    const r = await pool.query(sql, values);
    const inserted = r.rows[0];

    // attach drive info in response if available
    if (driveInfo) {
      inserted.drive = { id: driveInfo.id, webViewLink: driveInfo.webViewLink || null, name: driveInfo.name || inserted.original_name };
    }

    return res.json({ ok: true, file: inserted });
  } catch (err) {
    console.error('POST /admin/uploads error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Delete upload by id (client expects DELETE /api/admin/uploads/:id)
router.delete('/uploads/:id', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query('SELECT path FROM uploads WHERE id = $1 LIMIT 1', [id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    const fileRelPath = r.rows[0].path || '';
    // delete DB record
    await pool.query('DELETE FROM uploads WHERE id = $1', [id]);

    // If local file, remove; if drive file stored as drive:<id>, try to delete via Drive if possible
    if (fileRelPath.startsWith('/uploads')) {
      const filePath = path.join(PUBLIC_DIR, fileRelPath);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { console.warn('Failed to remove file:', filePath, e && e.message ? e.message : e); }
    } else if (fileRelPath.startsWith('drive:')) {
      const fileId = fileRelPath.slice('drive:'.length);
      try {
        if (initDriveIfPossible()) {
          const drive = driveClient || require('googleapis').google.drive({ version: 'v3', auth: googleAuth });
          await drive.files.delete({ fileId });
        }
      } catch (e) { console.warn('Failed to delete drive file:', e && e.message ? e.message : e); }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /admin/uploads/:id error', err && err.stack ? err.stack : err);
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
    console.error('GET /admin/comments error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Batch approve/unapprove comments
// Body: { ids: [1,2,3], approved: true|false }
router.patch('/comments', ensureAdmin, async (req, res) => {
  try {
    const { ids, approved } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, error: 'ids_array_required' });
    if (typeof approved !== 'boolean') return res.status(400).json({ ok: false, error: 'approved_boolean_required' });

    // ensure ids are ints
    const idsInt = ids.map(i => parseInt(i, 10)).filter(i => !Number.isNaN(i));
    if (!idsInt.length) return res.status(400).json({ ok: false, error: 'ids_invalid' });

    const updateSql = 'UPDATE comments SET approved = $1 WHERE id = ANY($2::int[]) RETURNING id, approved';
    const r = await pool.query(updateSql, [approved, idsInt]);
    return res.json({ ok: true, updated: r.rows });
  } catch (err) {
    console.error('PATCH /admin/comments (batch) error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Approve/unapprove single comment (kept for compatibility)
router.patch('/comments/:id', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { approved } = req.body;
    if (typeof approved !== 'boolean') return res.status(400).json({ ok: false, error: 'approved_boolean_required' });
    const r = await pool.query('UPDATE comments SET approved = $1 WHERE id = $2 RETURNING id, approved', [approved, id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, comment: r.rows[0] });
  } catch (err) {
    console.error('PATCH /admin/comments/:id error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Shim: client sometimes calls POST /comments/:id/approve
router.post('/comments/:id/approve', ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query('UPDATE comments SET approved = true WHERE id = $1 RETURNING id, approved', [id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, comment: r.rows[0] });
  } catch (err) {
    console.error('POST /admin/comments/:id/approve error', err && err.stack ? err.stack : err);
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
    console.error('DELETE /admin/comments/:id error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ===== Users management: list / set role / delete ====== */

// List users -- build SELECT dynamically to avoid referencing missing columns
router.get('/users', ensureAdmin, async (req, res) => {
  try {
    // discover existing columns in users table
    const colsRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
    );
    const existing = (colsRes.rows || []).map(r => r.column_name);

    // helper to safely include a column or fallback expression
    const parts = [];

    // id and username preferred
    if (existing.includes('id')) parts.push('id');
    else parts.push('NULL::int AS id');

    if (existing.includes('username')) parts.push('username');
    else parts.push("'' AS username");

    // name: try name, full_name, display_name
    const nameCandidates = ['name','full_name','display_name'];
    const nameAvail = nameCandidates.filter(c => existing.includes(c));
    if (nameAvail.length) {
      const coalesced = nameAvail.map(c => `NULLIF(${c},'')`).join(', ');
      parts.push(`COALESCE(${coalesced}, '') AS name`);
    } else {
      parts.push(`'' AS name`);
    }

    // email
    if (existing.includes('email')) parts.push('email');
    else parts.push(`'' AS email`);

    // role
    if (existing.includes('role')) parts.push(`COALESCE(role, 'user') AS role`);
    else parts.push(`'user' AS role`);

    // created_at
    if (existing.includes('created_at')) parts.push('created_at');
    else parts.push('now() AS created_at');

    const sql = `SELECT ${parts.join(', ')} FROM users ORDER BY created_at DESC`;
    const r = await pool.query(sql);
    return res.json({ ok: true, users: r.rows });
  } catch (err) {
    console.error('GET /admin/users error', err && err.stack ? err.stack : err);
    // return message and stack for debugging (DEV only)
    return res.status(500).json({ ok: false, error: 'server_error', message: (err && err.message) ? err.message : String(err), stack: err && err.stack ? err.stack : null });
  }
});

// Set user role (body { role: 'admin'|'user' })
router.post('/users/:id/role', ensureAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { role } = req.body || {};
    if (!role || typeof role !== 'string') return res.status(400).json({ ok: false, error: 'role_required' });
    const r = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role', [role, id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, user: r.rows[0] });
  } catch (err) {
    console.error('POST /admin/users/:id/role error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error', message: (err && err.message) ? err.message : String(err) });
  }
});

// Delete user
router.delete('/users/:id', ensureAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    // Optional: prevent deleting yourself
    if (req.user && String(req.user.id) === String(id)) {
      return res.status(400).json({ ok: false, error: 'cannot_delete_self' });
    }
    const r = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, deleted: r.rows[0].id });
  } catch (err) {
    console.error('DELETE /admin/users/:id error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error', message: (err && err.message) ? err.message : String(err) });
  }
});

module.exports = router;