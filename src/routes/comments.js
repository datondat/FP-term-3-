'use strict';
/**
 * src/routes/comments.js
 *
 * Compatibility mode (no DB schema changes):
 * - Existing comments table has columns: id, user_id, content, approved, created_at
 * - This router will:
 *   - On POST: store a JSON string in `content` containing { text, fileId, author }
 *     (so we don't need new columns).
 *   - On GET: select recent rows and filter in application by fileId (if provided).
 *
 * Note: This trades DB-level filtering for app-level filtering. OK for small datasets.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

function buildCommentOutput(row) {
  // row: { id, user_id, content, approved, created_at }
  let parsed = null;
  let text = String(row.content || '');
  let fileId = null;
  let author = null;

  try {
    const j = JSON.parse(row.content);
    // If it matches our stored shape { text, fileId?, author? }, use those
    if (j && (typeof j.text === 'string' || typeof j.fileId !== 'undefined' || typeof j.author !== 'undefined')) {
      parsed = j;
      text = (typeof j.text === 'string') ? j.text : '';
      fileId = (typeof j.fileId !== 'undefined') ? j.fileId : null;
      author = (typeof j.author !== 'undefined') ? j.author : null;
    }
  } catch (e) {
    // not JSON — treat content as plain text
  }

  return {
    id: row.id,
    fileId: fileId,            // may be null for older/plain comments
    user_id: row.user_id,
    author: author,
    content: text,
    approved: row.approved,
    created_at: row.created_at
  };
}

/* GET /api/comments?fileId=... */
router.get('/', async (req, res) => {
  try {
    const fileIdFilter = req.query.fileId || null;

    // Select recent comments — keep limit moderate to avoid scanning huge tables
    const sql = 'SELECT id, user_id, content, approved, created_at FROM comments ORDER BY created_at DESC LIMIT 1000';
    const r = await pool.query(sql);

    // Map rows to objects and filter by fileId if requested
    const mapped = r.rows.map(buildCommentOutput);

    const filtered = fileIdFilter
      ? mapped.filter(c => String(c.fileId) === String(fileIdFilter))
      : mapped;

    // Limit results returned to 500 to the client
    return res.json({ ok: true, comments: filtered.slice(0, 500) });
  } catch (err) {
    console.error('GET /api/comments error', err && (err.stack || err));
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* POST /api/comments
   body: { fileId, content, author? } (JSON)
   Behavior:
   - Will store in `comments.content` a JSON string: { text, fileId, author }
   - Will keep user_id if req.session.userId exists.
   - Sets approved = true by default (so visible). Adjust if you want moderation.
*/
router.post('/', async (req, res) => {
  try {
    const { fileId, content, author } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ ok: false, error: 'content_required' });
    }

    const text = String(content).trim();
    const fid = (typeof fileId !== 'undefined' && fileId !== null) ? String(fileId) : null;
    const userId = req.session && req.session.userId ? req.session.userId : null;
    const authorStr = (author && String(author).trim()) ? String(author).trim() : null;

    // Build JSON payload to store in content column
    const payload = { text };
    if (fid) payload.fileId = fid;
    if (authorStr) payload.author = authorStr;

    const contentToStore = JSON.stringify(payload);

    // Insert into existing table columns: user_id, content, approved
    const sql = `
      INSERT INTO comments (user_id, content, approved)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, content, approved, created_at
    `;
    // approved set to true so new comments appear; change to false if moderation required
    const params = [userId, contentToStore, true];

    const r = await pool.query(sql, params);
    const row = r.rows[0];
    const out = buildCommentOutput(row);
    return res.json({ ok: true, comment: out });
  } catch (err) {
    console.error('POST /api/comments error', err && (err.stack || err));
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;