// src/routes/uploads.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const driveLib = (process.env.GOOGLE_DRIVE_ENABLED === 'true') ? require('../lib/drive') : null;
const driveFolders = (process.env.GOOGLE_DRIVE_ENABLED === 'true') ? require('../lib/drive-folders') : null;

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'attachments');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: parseInt(process.env.MAX_FILE_BYTES || '52428800', 10) } });

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  req.user = req.session.user;
  next();
}

// POST /api/uploads?class_id=...&subject_id=...
router.post('/', requireAuth, upload.array('files', 12), async (req, res) => {
  try {
    const class_id = req.query.class_id ? parseInt(req.query.class_id, 10) : null;
    const subject_id = req.query.subject_id ? parseInt(req.query.subject_id, 10) : null;
    if (!class_id || !subject_id) return res.status(400).json({ ok: false, error: 'class_id and subject_id required' });

    const sres = await db.query('SELECT id, title FROM subjects WHERE id = $1 LIMIT 1', [subject_id]);
    const subjectName = sres.rows[0] ? sres.rows[0].title : `subject-${subject_id}`;
    const cres = await db.query('SELECT id, name FROM classes WHERE id = $1 LIMIT 1', [class_id]);
    const className = cres.rows[0] ? (cres.rows[0].name || `class-${class_id}`) : `class-${class_id}`;

    const uploader = req.user.id;
    const results = [];
    for (const file of req.files) {
      let storage_provider = 'local';
      let storage_key = path.basename(file.filename);
      let drive_parent_folder_id = null;

      if (driveLib && driveLib.enabled && driveFolders && driveFolders.enabled) {
        // create/find folder class -> subject and upload
        const { driveFolderId } = await driveFolders.getOrCreateFolderFor(class_id, subject_id, className, subjectName);
        drive_parent_folder_id = driveFolderId;

        const uploaded = await driveFolders.uploadFileToFolder(path.join(uploadDir, storage_key), driveFolderId, file.originalname, file.mimetype);
        storage_provider = 'gdrive';
        storage_key = uploaded.id;

        // remove local copy to save disk
        try { await fs.promises.unlink(path.join(uploadDir, path.basename(file.filename))); } catch (e) { /* ignore */ }
      }

      const insert = await db.query(
        `INSERT INTO attachments (class_id, subject_id, filename, storage_key, mime_type, file_size, uploaded_by, storage_provider, drive_parent_folder_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [class_id, subject_id, file.originalname, storage_key, file.mimetype, file.size, uploader, storage_provider, drive_parent_folder_id]
      );
      const row = insert.rows[0];
      if (storage_provider === 'local') row.publicUrl = '/uploads/attachments/' + storage_key;
      results.push(row);
    }

    res.json({ ok: true, attachments: results });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Download route unchanged
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const q = await db.query('SELECT * FROM attachments WHERE id = $1', [id]);
    const a = q.rows[0];
    if (!a) return res.status(404).json({ ok: false, error: 'Not found' });

    if (req.user.id !== a.uploaded_by && req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    if (!a.storage_provider || a.storage_provider === 'local') {
      const filePath = path.join(__dirname, '..', 'public', 'uploads', 'attachments', a.storage_key);
      return res.download(filePath, a.filename);
    }

    if (a.storage_provider === 'gdrive') {
      if (!driveLib || !driveLib.enabled) return res.status(500).json({ ok: false, error: 'Drive not configured' });
      const tmp = path.join(require('os').tmpdir(), `${Date.now()}-${a.filename.replace(/\s+/g,'_')}`);
      try {
        await driveLib.downloadFileToPath(a.storage_key, tmp);
        return res.download(tmp, a.filename, (err) => { try { fs.unlinkSync(tmp); } catch (e) {} });
      } catch (err) {
        console.error('Drive download error', err);
        return res.status(500).json({ ok: false, error: 'Failed to download from Drive' });
      }
    }

    return res.status(500).json({ ok: false, error: 'Unknown storage provider' });
  } catch (err) {
    console.error('Download error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;