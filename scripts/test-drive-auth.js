#!/usr/bin/env node
/**
 * Usage:
 *  node scripts/test-drive-auth.js <FOLDER_ID>
 *
 * Yêu cầu:
 *  - GOOGLE_APPLICATION_CREDENTIALS trỏ tới file key JSON (service account)
 *  - npm install googleapis dotenv
 */

require('dotenv').config();
const { google } = require('googleapis');

const folderId = process.argv[2];
if (!folderId) {
  console.error('Usage: node scripts/test-drive-auth.js <FOLDER_ID>');
  process.exit(1);
}

async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });

    // liệt kê file trong folder
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 100,
    });

    const files = res.data.files || [];
    console.log(`Found ${files.length} file(s) in folder ${folderId}:`);
    files.forEach(f => console.log(` - ${f.name} (${f.id}) [${f.mimeType}]`));
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();