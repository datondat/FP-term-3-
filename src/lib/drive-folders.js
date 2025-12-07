// src/lib/drive-folders.js
const fs = require('fs');
const db = require('../db');

const driveLib = require('./drive');
if (!driveLib || !driveLib.enabled) {
  module.exports = { enabled: false };
  return;
}
const drive = driveLib.drive;
const ROOT = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

function escapeName(n) {
  return (n || '').replace(/'/g, "\\'");
}

async function findFolderByName(parentId, folderName) {
  const qParts = [
    `mimeType='application/vnd.google-apps.folder'`,
    `name='${escapeName(folderName)}'`,
    `trashed = false`
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  const q = qParts.join(' and ');
  const res = await drive.files.list({ q, fields: 'files(id,name,parents)', spaces: 'drive', pageSize: 10 });
  return (res.data.files && res.data.files[0]) || null;
}

async function createFolder(parentId, folderName) {
  const metadata = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) metadata.parents = [parentId];
  const res = await drive.files.create({ requestBody: metadata, fields: 'id,name,parents' });
  return res.data;
}

// Ensure a subject folder exists inside a class folder (class -> subject).
// classId/subjectId may be null, but className/subjectName are used to create/find folders.
async function getOrCreateFolderFor(classId, subjectId, className, subjectName) {
  const mapRes = await db.query('SELECT drive_folder_id FROM drive_folders WHERE class_id = $1 AND subject_id = $2 LIMIT 1', [classId, subjectId]);
  if (mapRes.rows.length) return { driveFolderId: mapRes.rows[0].drive_folder_id, fromDb: true };

  // find/create class folder under ROOT
  let classFolder = await findFolderByName(ROOT, className);
  if (!classFolder) classFolder = await createFolder(ROOT, className);

  // find/create subject folder under class folder
  let subjectFolder = await findFolderByName(classFolder.id, subjectName);
  if (!subjectFolder) subjectFolder = await createFolder(classFolder.id, subjectName);

  const pathStr = `${className}/${subjectName}`;
  await db.query(
    `INSERT INTO drive_folders (class_id, subject_id, drive_folder_id, path)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (class_id, subject_id) DO UPDATE SET drive_folder_id = EXCLUDED.drive_folder_id, path = EXCLUDED.path`,
    [classId, subjectId, subjectFolder.id, pathStr]
  );

  return { driveFolderId: subjectFolder.id, fromDb: false };
}

async function uploadFileToFolder(localPath, folderId, filename, mimeType) {
  const media = { mimeType: mimeType || 'application/octet-stream', body: fs.createReadStream(localPath) };
  const metadata = { name: filename };
  if (folderId) metadata.parents = [folderId];
  const res = await drive.files.create({
    requestBody: metadata,
    media,
    fields: 'id, name, mimeType, webViewLink, size, parents'
  });
  return res.data;
}

module.exports = { enabled: true, getOrCreateFolderFor, uploadFileToFolder, findFolderByName, createFolder };