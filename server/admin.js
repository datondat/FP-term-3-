const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

/*
  Single-file admin module:
  - initDrive / uploadFileToDrive / listFilesInFolder / deleteFileById
  - Express router exposing:
    GET  /api/admin/uploads
    POST /api/admin/uploads
    DELETE /api/admin/uploads/:id
    GET  /api/admin/comments  (stub)
    POST /api/admin/comments/:id/approve (stub)
    DELETE /api/admin/comments/:id (stub)
    GET  /api/admin/users (stub)
    POST /api/admin/users/:id/role (stub)
    DELETE /api/admin/users/:id (stub)

  How to use:
  - Place this file anywhere (e.g. server/admin.js)
  - In your main server file: const adminRouter = require('./server/admin'); app.use('/api/admin', adminRouter);
  - Install deps: npm i googleapis multer fs-extra
  - Env:
      GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json  OR  GOOGLE_SERVICE_ACCOUNT_KEY='{"type":...}'
      DRIVE_UPLOAD_FOLDER_ID=<drive-folder-id>   (optional — if empty uploads go to root)
*/

///// Drive helper (service account)
let driveClient = null;
function initDrive() {
  if (driveClient) return driveClient;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  let auth;
  if (keyPath && fs.existsSync(keyPath)) {
    auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  } else if (keyJson) {
    // write a temp key file; keep it for process lifetime
    const tmp = path.join(os.tmpdir(), `gp-key-${process.pid}.json`);
    try { fs.writeFileSync(tmp, keyJson, { encoding: 'utf8' }); } catch(e){}
    auth = new google.auth.GoogleAuth({
      keyFile: tmp,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  } else {
    throw new Error('Missing Google credentials. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_KEY.');
  }
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

async function uploadFileToDrive({ filepath, filename, mimeType, parentId }) {
  const drive = initDrive();
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: parentId ? [parentId] : undefined,
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: fs.createReadStream(filepath),
    },
    fields: 'id,name,size,createdTime,mimeType,webViewLink',
  });
  return res.data;
}

async function listFilesInFolder(parentId, pageSize = 200) {
  const drive = initDrive();
  const q = parentId ? `'${parentId}' in parents and trashed = false` : 'trashed = false';
  const res = await drive.files.list({
    q,
    pageSize,
    fields: 'files(id,name,size,createdTime,mimeType,webViewLink)',
    orderBy: 'createdTime desc',
  });
  return res.data.files || [];
}

async function deleteFileById(fileId) {
  const drive = initDrive();
  await drive.files.delete({ fileId });
  return true;
}

///// Express router
const router = express.Router();

// temp upload dir
const TMP_DIR = path.join(process.cwd(), 'tmp', 'uploads');
fs.ensureDirSync(TMP_DIR);
const upload = multer({ dest: TMP_DIR });

// NOTE: replace verifyAdmin with your real auth middleware if you have one.
// This sample expects req.session.user.role === 'admin' — change as needed.
function verifyAdmin(req, res, next) {
  try {
    const user = (req.session && req.session.user) || (req.user || null);
    if (!user || user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Forbidden' });
    return next();
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Auth error' });
  }
}

/* ========== Uploads ========== */

// GET /api/admin/uploads
router.get('/uploads', verifyAdmin, async (req, res) => {
  try {
    const folderId = process.env.DRIVE_UPLOAD_FOLDER_ID || null;
    const files = await listFilesInFolder(folderId);
    const out = files.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size ? Number(f.size) : null,
      createdAt: f.createdTime,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink || null,
    }));
    res.json({ ok: true, uploads: out });
  } catch (err) {
    console.error('GET /api/admin/uploads error', err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

// POST /api/admin/uploads (multipart/form-data, field name: file)
router.post('/uploads', verifyAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });
  const tempPath = req.file.path;
  const originalName = req.file.originalname || req.file.filename;
  try {
    const folderId = process.env.DRIVE_UPLOAD_FOLDER_ID || null;
    const f = await uploadFileToDrive({
      filepath: tempPath,
      filename: originalName,
      mimeType: req.file.mimetype,
      parentId: folderId,
    });
    // remove temp
    await fs.remove(tempPath).catch(()=>{});
    res.json({ ok: true, file: { id: f.id, name: f.name, size: f.size, createdAt: f.createdTime, webViewLink: f.webViewLink } });
  } catch (err) {
    console.error('POST /api/admin/uploads upload error', err);
    try { await fs.remove(tempPath).catch(()=>{}); } catch(e){}
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

// DELETE /api/admin/uploads/:id
router.delete('/uploads/:id', verifyAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    await deleteFileById(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/uploads/:id error', err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

/* ========== Comments & Users (stubs) ========== */
// Replace with your DB logic if you have it.
router.get('/comments', verifyAdmin, async (req, res) => {
  res.json({ ok: true, comments: [] });
});
router.post('/comments/:id/approve', verifyAdmin, async (req, res) => {
  res.json({ ok: true });
});
router.delete('/comments/:id', verifyAdmin, async (req, res) => {
  res.json({ ok: true });
});

router.get('/users', verifyAdmin, async (req, res) => {
  res.json({ ok: true, users: [] });
});
router.post('/users/:id/role', verifyAdmin, async (req, res) => {
  res.json({ ok: true });
});
router.delete('/users/:id', verifyAdmin, async (req, res) => {
  res.json({ ok: true });
});

module.exports = router;