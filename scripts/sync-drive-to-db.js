// scripts/sync-drive-to-db.js
require('dotenv').config();
const db = require('../src/db');
const driveLib = require('../src/lib/drive');
const driveFolders = require('../src/lib/drive-folders');

if (!driveLib || !driveLib.enabled) {
  console.error('Drive not enabled. Set GOOGLE_DRIVE_ENABLED=true and GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

const drive = driveLib.drive;
const ROOT = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function listFolders(parentId) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 200
  });
  return res.data.files || [];
}

async function listFiles(parentId) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name,mimeType,size,createdTime)',
    pageSize: 200
  });
  return res.data.files || [];
}

async function syncAll() {
  const classFolders = await listFolders(ROOT);
  for (const cls of classFolders) {
    const subjectFolders = await listFolders(cls.id);
    for (const subj of subjectFolders) {
      // attempt to find class_id and subject_id in DB by name
      const c = await db.query('SELECT id FROM classes WHERE name = $1 LIMIT 1', [cls.name]);
      const s = await db.query('SELECT id FROM subjects WHERE title = $1 LIMIT 1', [subj.name]);
      const classId = c.rows[0] ? c.rows[0].id : null;
      const subjectId = s.rows[0] ? s.rows[0].id : null;

      await db.query(
        `INSERT INTO drive_folders (class_id, subject_id, drive_folder_id, path)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (class_id, subject_id) DO UPDATE SET drive_folder_id = EXCLUDED.drive_folder_id, path = EXCLUDED.path`,
        [classId, subjectId, subj.id, `${cls.name}/${subj.name}`]
      );

      const files = await listFiles(subj.id);
      for (const f of files) {
        const exists = await db.query('SELECT id FROM attachments WHERE storage_provider=$1 AND storage_key=$2 LIMIT 1', ['gdrive', f.id]);
        if (exists.rows.length) continue;
        await db.query(
          `INSERT INTO attachments (class_id, subject_id, filename, storage_key, mime_type, file_size, uploaded_by, storage_provider, drive_parent_folder_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [classId, subjectId, f.name, f.id, f.mimeType, f.size ? parseInt(f.size, 10) : null, null, 'gdrive', subj.id, f.createdTime]
        );
        console.log('Inserted:', f.name, '->', cls.name, '/', subj.name);
      }
    }
  }
}

syncAll().then(()=>{ console.log('Done'); process.exit(0); }).catch(err=>{ console.error(err); process.exit(1); });