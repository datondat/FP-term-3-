// src/routes/classSubjects.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/classes/:id/subjects
router.get('/:id/subjects', async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    if (!classId) return res.status(400).json({ ok: false, error: 'class id required' });

    const subjectsRes = await db.query('SELECT id, title FROM subjects ORDER BY title');
    const mappingRes = await db.query('SELECT subject_id FROM class_subjects WHERE class_id = $1', [classId]);
    const assignedSet = new Set(mappingRes.rows.map(r => r.subject_id));

    const subjects = subjectsRes.rows.map(s => ({ id: s.id, title: s.title, assigned: assignedSet.has(s.id) }));
    res.json({ ok: true, class_id: classId, subjects });
  } catch (err) {
    console.error('GET /api/classes/:id/subjects error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/classes/:id/subjects  { subject_ids: [1,2,3] }
router.post('/:id/subjects', async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const subjectIds = Array.isArray(req.body.subject_ids) ? req.body.subject_ids.map(x => parseInt(x,10)).filter(Boolean) : [];

    if (!classId) return res.status(400).json({ ok: false, error: 'class id required' });

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM class_subjects WHERE class_id = $1', [classId]);
      const insertText = 'INSERT INTO class_subjects (class_id, subject_id) VALUES ($1,$2)';
      for (const sid of subjectIds) {
        await client.query(insertText, [classId, sid]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true, class_id: classId, subject_ids: subjectIds });
  } catch (err) {
    console.error('POST /api/classes/:id/subjects error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;