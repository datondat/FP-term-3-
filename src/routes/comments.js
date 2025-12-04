// src/routes/comments.js
const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('./auth');

const router = express.Router();

// List comments by materialId
router.get('/', async (req, res) => {
  const materialId = req.query.materialId || null;
  try {
    const client = await pool.connect();
    try {
      let q = `SELECT c.id, c.material_id, c.user_id, c.content, c.created_at, u.username, u.display_name
               FROM comments c
               LEFT JOIN users u ON u.id = c.user_id`;
      const params = [];
      if (materialId) {
        q += ' WHERE c.material_id = $1';
        params.push(materialId);
      }
      q += ' ORDER BY c.created_at DESC LIMIT 200';
      const r = await client.query(q, params);
      res.json({ ok: true, comments: r.rows.map(row => ({
        id: row.id,
        materialId: row.material_id,
        userId: row.user_id,
        content: row.content,
        createdAt: row.created_at,
        user: { username: row.username, displayName: row.display_name }
      }))});
    } finally { client.release(); }
  } catch (err) {
    console.error('comments list error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Post a comment (requires auth)
router.post('/', authMiddleware, async (req, res) => {
  const { materialId, content } = req.body || {};
  if (!materialId || !content) return res.status(400).json({ ok: false, error: 'materialId and content required' });
  try {
    const client = await pool.connect();
    try {
      const r = await client.query(
        `INSERT INTO comments (material_id, user_id, content, created_at)
         VALUES ($1,$2,$3,now()) RETURNING id, material_id, user_id, content, created_at`,
        [materialId, req.user.id, content]
      );
      const row = r.rows[0];
      res.json({ ok: true, comment: { id: row.id, materialId: row.material_id, userId: row.user_id, content: row.content, createdAt: row.created_at }});
    } finally { client.release(); }
  } catch (err) {
    console.error('comments post error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;