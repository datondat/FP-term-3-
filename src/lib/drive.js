// src/lib/drive.js
const fs = require('fs');
const { google } = require('googleapis');

const KEYFILE = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

if (!process.env.GOOGLE_DRIVE_ENABLED || process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
  module.exports = { enabled: false };
  return;
}

if (!KEYFILE || !fs.existsSync(KEYFILE)) {
  throw new Error('Google Drive key file not found. Set GOOGLE_APPLICATION_CREDENTIALS to path of service account JSON.');
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILE,
  scopes: ['https://www.googleapis.com/auth/drive']
});

const drive = google.drive({ version: 'v3', auth });

async function uploadFile(localPath, filename, mimeType, parents = null) {
  const fileMetadata = { name: filename };
  if (parents) fileMetadata.parents = parents;
  else if (FOLDER_ID) fileMetadata.parents = [FOLDER_ID];
  const media = { mimeType: mimeType || 'application/octet-stream', body: fs.createReadStream(localPath) };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, mimeType, webViewLink, webContentLink, size, parents'
  });
  return res.data;
}

async function downloadFileToPath(fileId, destPath) {
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    res.data.on('end', () => resolve()).on('error', err => reject(err)).pipe(dest);
  });
  return destPath;
}

async function findFile(fileId, fields = 'id,name,mimeType,parents,size,createdTime') {
  const res = await drive.files.get({ fileId, fields });
  return res.data;
}

module.exports = {
  enabled: true,
  drive,
  uploadFile,
  downloadFileToPath,
  findFile
};