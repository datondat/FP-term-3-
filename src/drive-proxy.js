/**
 * src/drive-proxy.js
 * Express router providing:
 *  GET /api/drive-files?root=<FOLDER_ID>&class=<CLASS>&subject=<SUBJECT>
 *
 * Requirements:
 *  - Environment variable GOOGLE_API_KEY with a valid Google API key (Drive API enabled).
 *
 * Notes:
 *  - Works best if Drive items/folders under `root` are shared "Anyone with the link".
 *  - For private Drive access you must implement OAuth/service-account (not covered here).
 */
const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const router = express.Router();
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.warn('WARNING: GOOGLE_API_KEY not set. Drive listing may fail for non-public folders.');
}

// Call Drive API files.list
async function driveListFiles(q, fields = 'files(id,name,mimeType,webViewLink,thumbnailLink)') {
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&key=${API_KEY}&pageSize=1000`;
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) {
    const txt = await r.text().catch(() => null);
    throw new Error(`Drive API error: ${r.status} ${r.statusText} ${txt || ''}`);
  }
  return r.json();
}

async function findChildFolder(parentId, needle) {
  const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await driveListFiles(q, 'files(id,name)');
  if (!res || !res.files) return null;
  const needleLower = (needle || '').toLowerCase().trim();
  let best = null;
  for (const f of res.files) {
    if (!f.name) continue;
    const n = f.name.toLowerCase();
    if (n === needleLower) return f;
    if (n.includes(needleLower) && !best) best = f;
  }
  return best || null;
}

async function listFilesInFolder(folderId) {
  const q = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await driveListFiles(q, 'files(id,name,mimeType,webViewLink,thumbnailLink)');
  return (res && res.files) ? res.files : [];
}

function drivePreviewUrl(file) {
  if (file.webViewLink) return file.webViewLink;
  if (file.id) return `https://drive.google.com/file/d/${file.id}/view`;
  return null;
}

// API route
router.get('/drive-files', async (req, res) => {
  const root = req.query.root;
  const klass = req.query.class || req.query.lop || req.query.grade || '';
  const subject = req.query.subject || req.query.mon || req.query.sub || '';

  if (!root) return res.status(400).json({ error: 'Missing root folder id (query param root)' });

  try {
    let targetFolderId = null;
    const debug = [];

    if (klass) {
      const candidates = [`Lớp ${klass}`, `Lop ${klass}`, `${klass}`];
      for (const cand of candidates) {
        const found = await findChildFolder(root, cand);
        debug.push({ tryClassCandidate: cand, found: !!found, folder: found && found.name });
        if (found) {
          if (subject) {
            const foundSubject = await findChildFolder(found.id, subject);
            debug.push({ trySubjectInClass: subject, found: !!foundSubject, subjectFolder: foundSubject && foundSubject.name });
            if (foundSubject) {
              targetFolderId = foundSubject.id;
              break;
            }
          }
          if (!subject) {
            targetFolderId = found.id;
            break;
          }
        }
      }
    }

    if (!targetFolderId && subject) {
      const foundDirect = await findChildFolder(root, subject);
      debug.push({ trySubjectDirect: subject, found: !!foundDirect, folder: foundDirect && foundDirect.name });
      if (foundDirect) targetFolderId = foundDirect.id;
    }

    if (!targetFolderId) {
      targetFolderId = root;
      debug.push({ fallbackToRoot: true });
    }

    const files = await listFilesInFolder(targetFolderId);
    const mapped = files.map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink || drivePreviewUrl(f),
      thumbnailLink: f.thumbnailLink || null,
      previewUrl: drivePreviewUrl(f)
    }));

    return res.json({ ok: true, debug, root, targetFolderId, count: mapped.length, files: mapped });
  } catch (err) {
    console.error('drive-files error', err);
    return res.status(500).json({ error: String(err) });
  }
});

module.exports = router;