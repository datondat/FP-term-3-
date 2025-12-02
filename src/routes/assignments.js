const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db'); // đảm bảo path đúng: exports.query

// lưu local uploads (public/uploads/submissions)
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'submissions');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${Math.round(Math.random()*1e9)}-${file.originalname.replace(/\s+/g,'_')}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

// Middleware giả lập auth (bạn thay bằng middleware thực)
function requireAuth(req, res, next) {
  // demo: giả sử req.user đã được set ở middleware auth chính
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

// CREATE assignment (teacher)
router.post('/', requireAuth, async (req, res) => {
  try {
    // kiểm tra role (giả sử user có role trong req.user.role)
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const { title, description, class_id, due_at } = req.body;
    const r = await db.query(
      `INSERT INTO assignments (title, description, class_id, due_at, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, description, class_id || null, due_at || null, req.user.id]
    );
    res.json({ ok: true, assignment: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// LIST assignments (filter by class or created_by)
router.get('/', requireAuth, async (req, res) => {
  try {
    const class_id = req.query.class_id ? parseInt(req.query.class_id,10) : null;
    const q = await db.query(
      `SELECT a.*, u.display_name as creator
       FROM assignments a LEFT JOIN users u ON a.created_by = u.id
       WHERE ($1::int IS NULL OR a.class_id = $1)
       ORDER BY a.created_at DESC
      `, [class_id]
    );
    res.json({ ok: true, assignments: q.rows });
  } catch (err) { res.status(500).json({ ok:false, error: err.message }); }
});

// GET one assignment (with questions)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id,10);
    const a = await db.query('SELECT * FROM assignments WHERE id = $1', [id]);
    if (!a.rows[0]) return res.status(404).json({ ok:false, error:'Not found' });
    const qs = await db.query('SELECT * FROM assignment_questions WHERE assignment_id = $1', [id]);
    res.json({ ok:true, assignment: a.rows[0], questions: qs.rows });
  } catch (err) { res.status(500).json({ ok:false, error: err.message }); }
});

// Teacher: list submissions for an assignment
router.get('/:id/submissions', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id,10);
    // only teacher/admin or assignment creator
    const assignment = await db.query('SELECT * FROM assignments WHERE id = $1', [id]);
    if (!assignment.rows[0]) return res.status(404).json({ ok:false, error:'Not found' });
    // allow if teacher/admin or creator
    if (req.user.role !== 'teacher' && req.user.role !== 'admin' && req.user.id !== assignment.rows[0].created_by) {
      return res.status(403).json({ ok:false, error:'Forbidden' });
    }
    const subs = await db.query(
      `SELECT s.*, u.display_name FROM submissions s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.assignment_id = $1
       ORDER BY s.submitted_at DESC`, [id]
    );
    res.json({ ok:true, submissions: subs.rows });
  } catch (err) { res.status(500).json({ ok:false, error: err.message }); }
});

// Mount attachment download for submissions handled in submissions router
module.exports = router;