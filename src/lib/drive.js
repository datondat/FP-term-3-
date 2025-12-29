const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, 'service-account.json');
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || ''; // root folder id
const PAGE_SIZE_DEFAULT = 50;
const API_KEY = process.env.GOOGLE_API_KEY || ''; // fallback for public access

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
    console.warn('[drive] No service account key and no GOOGLE_API_KEY set. Drive access will fail.');
  }
}

const drive = google.drive({ version: 'v3' });

// Helper to call drive.files.list with auth (service account) or API key fallback
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

// Helper to get/stream file
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

/*
  GET /api/drive/folders?parentId=<id>
  Returns immediate child FOLDERS of parentId (or DRIVE_FOLDER_ID if omitted).
  Response: { ok:true, folders: [{id,name}] }
*/
router.get('/api/drive/folders', async (req, res) => {
  try {
    const parentId = req.query.parentId || DRIVE_FOLDER_ID;
    if (!parentId) return res.status(500).json({ ok: false, error: 'DRIVE_FOLDER_ID not configured and parentId not provided' });

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

/*
  GET /api/drive/files?folderId=<id>&pageSize=&pageToken=
  Lists non-folder files inside folderId.
  Response: { ok:true, files: [{id,name,mimeType,size,webViewLink}], nextPageToken }
*/
router.get('/api/drive/files', async (req, res) => {
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

/*
  GET /api/drive/file/:id
  Streams file content via server (works with service account or API key for public files)
*/
router.get('/api/drive/file/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    if (!fileId) return res.status(400).send('missing file id');

    // get metadata
    const metaResp = await (authClient ? drive.files.get({ fileId, fields: 'id,name,mimeType,size,webViewLink', auth: await authClient.getClient() }) : drive.files.get({ fileId, fields: 'id,name,mimeType,size,webViewLink', key: API_KEY }));
    const meta = metaResp.data || {};
    const { name, mimeType } = meta;

    // get media stream
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

module.exports = router;