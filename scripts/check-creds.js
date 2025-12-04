#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');

console.log('Process CWD:', process.cwd());
console.log('GOOGLE_APPLICATION_CREDENTIALS =', process.env.GOOGLE_APPLICATION_CREDENTIALS || '<not set>');

const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!p) {
  console.error('-> GOOGLE_APPLICATION_CREDENTIALS chưa được đặt.');
  process.exit(1);
}

try {
  if (fs.existsSync(p)) {
    console.log('-> File JSON tồn tại ở:', p);
    try {
      const json = JSON.parse(fs.readFileSync(p, 'utf8'));
      console.log('-> client_email =', json.client_email || '<không tìm thấy client_email>');
    } catch (e) {
      console.error('-> Không thể parse JSON:', e.message);
    }
  } else {
    console.error('-> File JSON KHÔNG tồn tại tại đường dẫn trên.');
  }
} catch (e) {
  console.error('-> Lỗi khi kiểm tra file:', e.message);
}