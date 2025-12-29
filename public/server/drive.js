const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/*
  Routes are relative (no leading /api). Mount this router under '/api' in your entry (src/index.js)
  Endpoints:
    GET  /api/drive/folders?parentId=...
    GET  /api/drive/files?folderId=...
    GET  /api/drive/file/:id
    GET  /api/drive/search?grade=6&subject=Toán
*/

const KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, 'service-account.json');
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || ''; // optional root folder id
const PAGE_SIZE_DEFAULT = 50;
const API_KEY = process.env.GOOGLE_API_KEY || ''; // fallback for public files

// prepare auth if service account key exists
let authClient = null;
if (fs.existsSync(KEY_PATH)) {
  authClient = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  console.info('[drive] Service account key found. Using service account for Drive API.');
} else {
  if (API_KEY) {
    console.info('[drive] No service account key found. Using API key fallback for public Drive access.');
  } else {
    console.warn('[drive] No service account key and no GOOGLE_API_KEY set. Drive access will fail for private files.');
  }
}

const drive = google.drive({ version: 'v3' });

async function driveFilesList(params = {}) {
  if (authClient) {
    const client = await authClient.getClient();
    return drive.files.list(Object.assign({}, params, { auth: client }));
  } else if (API_KEY) {
    return drive.files.list(Object.assign({}, params, { key: API_KEY }));
  } else {
    throw new Error('No auth available for Drive API (set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_API_KEY)');
  }
}

async function driveFilesGet(params = {}, requestOptions = {}) {
  if (authClient) {
    const client = await authClient.getClient();
    return drive.files.get(Object.assign({}, params, { auth: client }), requestOptions);
  } else if (API_KEY) {
    return drive.files.get(Object.assign({}, params, { key: API_KEY }), requestOptions);
  } else {
    throw new Error('No auth available for Drive API (set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_API_KEY)');
  }
}

/* GET /drive/folders?parentId=<id>
   If parentId omitted, uses DRIVE_FOLDER_ID env (recommended).
   Returns: { ok:true, folders: [{id,name}] } */
router.get('/drive/folders', async (req, res) => {
  try {
    const parentId = req.query.parentId || DRIVE_FOLDER_ID;
    if (!parentId) return res.status(400).json({ ok: false, error: 'parentId required or set DRIVE_FOLDER_ID env' });

    const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const r = await driveFilesList({
      q,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 200
    });
    const folders = (r.data && r.data.files) ? r.data.files.map(f => ({ id: f.id, name: f.name })) : [];
    return res.json({ ok: true, folders });
  } catch (err) {
    console.error('Drive folders error', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/* GET /drive/files?folderId=<id>&pageSize=&pageToken=
   Lists non-folder files inside folderId. */
router.get('/drive/files', async (req, res) => {
  try {
    const folderId = req.query.folderId;
    if (!folderId) return res.status(400).json({ ok: false, error: 'folderId query parameter is required' });

    const pageSize = Math.min(Number(req.query.pageSize) || PAGE_SIZE_DEFAULT, 200);
    const pageToken = req.query.pageToken || undefined;
    const q = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;

    const r = await driveFilesList({
      q,
      fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink)',
      pageSize,
      pageToken
    });

    return res.json({
      ok: true,
      files: r.data.files || [],
      nextPageToken: r.data.nextPageToken || null
    });
  } catch (err) {
    console.error('Drive files error', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/* GET /drive/file/:id  - stream file through server */
router.get('/drive/file/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    if (!fileId) return res.status(400).send('missing file id');

    const metaResp = authClient
      ? await drive.files.get({ fileId, fields: 'id,name,mimeType,size,webViewLink', auth: await authClient.getClient() })
      : await drive.files.get({ fileId, fields: 'id,name,mimeType,size,webViewLink', key: API_KEY });

    const meta = metaResp.data || {};
    const { name, mimeType } = meta;

    const streamResp = await driveFilesGet({ fileId, alt: 'media' }, { responseType: 'stream' });

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    const inlineTypes = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/html'];
    const disposition = inlineTypes.includes(mimeType) ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(name || fileId)}"`);

    streamResp.data.pipe(res);
  } catch (err) {
    console.error('Drive file/stream error', err);
    if (err && err.code === 404) return res.status(404).json({ ok: false, error: 'file not found' });
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/* GET /drive/search?grade=6&subject=Toán
   Convenience endpoint: resolve grade folder -> subject folder -> list files */
router.get('/drive/search', async (req, res) => {
  try {
    const grade = req.query.grade;
    const subject = req.query.subject;
    if (!grade || !subject) return res.status(400).json({ ok: false, error: 'grade and subject are required' });

    const mapping = (process.env.DRIVE_GRADE_FOLDERS_JSON && JSON.parse(process.env.DRIVE_GRADE_FOLDERS_JSON)) || {};
    let gradeFolderId = mapping[grade] || null;

    if (!gradeFolderId) {
      let rootResp;
      if (DRIVE_FOLDER_ID) {
        rootResp = await driveFilesList({
          q: `'${DRIVE_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id,name)',
          pageSize: 200
        });
      } else {
        rootResp = await driveFilesList({
          q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: 'files(id,name)',
          pageSize: 200
        });
      }
      const roots = (rootResp && rootResp.data && rootResp.data.files) ? rootResp.data.files : [];
      const targetCandidates = [`lớp ${grade}`, `lop ${grade}`, `${grade}`].map(n => n.normalize ? n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase() : n.toLowerCase());
      for (const f of roots) {
        const n = f.name.normalize ? f.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase() : f.name.toLowerCase();
        if (targetCandidates.includes(n) || targetCandidates.some(t => n.includes(t))) { gradeFolderId = f.id; break; }
      }
    }

    if (!gradeFolderId) return res.status(404).json({ ok: false, error: 'Grade folder not found' });

    const sfResp = await driveFilesList({
      q: `'${gradeFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id,name)',
      pageSize: 500
    });

    const subfolders = (sfResp && sfResp.data && sfResp.data.files) ? sfResp.data.files : [];
    const normalizedSubject = subject.normalize ? subject.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase() : subject.toLowerCase();
    let found = subfolders.find(s => {
      const n = s.name.normalize ? s.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase() : s.name.toLowerCase();
      return n === normalizedSubject || n.includes(normalizedSubject) || normalizedSubject.includes(n);
    });
    if (!found) return res.status(404).json({ ok: false, error: 'Subject folder not found', subfolders });

    const filesResp = await driveFilesList({
      q: `'${found.id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id,name,mimeType,size,webViewLink)',
      pageSize: 500
    });

    return res.json({ ok: true, files: (filesResp.data && filesResp.data.files) ? filesResp.data.files : [] });
  } catch (err) {
    console.error('drive/search error', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

module.exports = router;