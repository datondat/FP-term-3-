'use strict';
/**
 * src/routes/comments.js
 * GET  /api/comments?fileId=...
 * POST /api/comments
 *
 * Requires src/db.js exporting { pool }.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

function formatRow(row) {
  return {
    id: row.id,
    fileId: row.file_id,
    user_id: row.user_id,
    author: row.author,
    content: row.content,
    created_at: row.created_at
  };
}

/* GET /api/comments?fileId=... */
router.get('/', async (req, res) => {
  try {
    const fileId = req.query.fileId || null;
    let sql = 'SELECT id, file_id, user_id, author, content, created_at FROM comments';
    const params = [];
    if (fileId) {
      sql += ' WHERE file_id = $1';
      params.push(fileId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 500';
    const r = await pool.query(sql, params);
    return res.json({ ok: true, comments: r.rows.map(formatRow) });
  } catch (err) {
    console.error('GET /api/comments error', err && (err.stack || err));
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* POST /api/comments
   body: { fileId, content, author? }
*/
router.post('/', async (req, res) => {
  try {
    const { fileId, content, author } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ ok: false, error: 'content_required' });
    }
    const fid = fileId ? String(fileId) : null;
    const userId = req.session && req.session.userId ? req.session.userId : null;

    let authorToSave = null;
    if (userId) {
      authorToSave = author && String(author).trim() ? String(author).trim() : null;
    } else {
      authorToSave = author && String(author).trim() ? String(author).trim() : 'Khách';
    }

    const sql = `
      INSERT INTO comments (file_id, user_id, author, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, file_id, user_id, author, content, created_at
    `;
    const params = [fid, userId, authorToSave, String(content).trim()];
    const r = await pool.query(sql, params);
    const inserted = r.rows[0];
    return res.json({ ok: true, comment: formatRow(inserted) });
  } catch (err) {
    console.error('POST /api/comments error', err && (err.stack || err));
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;