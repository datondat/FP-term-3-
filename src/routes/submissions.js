const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const util = require('util');
const db = require('../db');

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

// Middleware auth (demo)
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ ok:false, error:'Unauthorized' });
  next();
}

// Request logger middleware for debug: log incoming request basics (before multer)
router.use((req, res, next) => {
  console.log('--- submissions router incoming ---');
  console.log(`${req.method} ${req.originalUrl}`);
  console.log('Headers:', util.inspect(req.headers, { depth: 1 }));
  console.log('Query:', util.inspect(req.query, { depth: null }));
  console.log('Params:', util.inspect(req.params, { depth: null }));
  // Do not print req.body here for multipart (multer will populate it later)
  next();
});

/* -----------------------------------------------
   1) POST /api/submissions  (UPLOAD)
   Note: using upload.any() temporarily to accept different field names when debugging.
   Replace upload.any() with upload.array('files', 10) or upload.fields(...) when stable.
------------------------------------------------ */
router.post('/', requireAuth, upload.any(), async (req, res) => {
  try {
    // Debug: print everything now that multer has run
    console.log('--- POST /api/submissions handler ---');
    console.log('User:', util.inspect(req.user, { depth: 2 }));
    console.log('Body:', util.inspect(req.body, { depth: null }));
    console.log('Files:', util.inspect(req.files, { depth: null }));

    // accept assignment_id from query or body (form might send it as hidden input)
    const assignment_id = parseInt(req.query.assignment_id || req.body.assignment_id, 10);
    if (!assignment_id)
      return res.status(400).json({ ok:false, error:'assignment_id required' });

    const s = await db.query(
      `INSERT INTO submissions (assignment_id, user_id, comment, status)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [assignment_id, req.user.id, req.body.comment || null, 'submitted']
    );
    const submission = s.rows[0];

    const attachments = [];
    for (const file of req.files || []) {
      const r = await db.query(
        `INSERT INTO submission_attachments (submission_id, filename, storage_key, mime_type, file_size)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [submission.id, file.originalname, file.filename, file.mimetype, file.size]
      );
      attachments.push(r.rows[0]);
    }

    console.log('Insertion result:', { submission, attachments });
    res.json({ ok:true, submission, attachments });

  } catch (err) {
    console.error('ERROR in POST /api/submissions:', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

/* -----------------------------------------------
   2) GET list attachments for a submission
   GET /api/submissions/:id/attachments
------------------------------------------------ */
router.get('/:id/attachments', requireAuth, async (req, res) => {
  try {
    console.log('GET /api/submissions/:id/attachments', { params: req.params, user: req.user && req.user.id });
    const id = parseInt(req.params.id, 10);
    const q = await db.query('SELECT * FROM submission_attachments WHERE submission_id = $1', [id]);
    res.json({ ok:true, attachments: q.rows });
  } catch (err) {
    console.error('ERROR in GET /:id/attachments', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

/* -----------------------------------------------
   3) DOWNLOAD attachment
   GET /api/submissions/attachments/:id/download
------------------------------------------------ */
router.get('/attachments/:id/download', requireAuth, async (req, res) => {
  try {
    console.log('GET /api/submissions/attachments/:id/download', { params: req.params, user: req.user && req.user.id });
    const id = parseInt(req.params.id, 10);
    const q = await db.query('SELECT * FROM submission_attachments WHERE id = $1', [id]);
    const a = q.rows[0];
    if (!a) return res.status(404).json({ ok:false, error:'Not found' });

    const filePath = path.join(uploadDir, a.storage_key);

    const sub = await db.query('SELECT * FROM submissions WHERE id = $1', [a.submission_id]);
    const submission = sub.rows[0];
    if (!submission) return res.status(404).json({ ok:false, error:'Submission not found' });

    if (req.user.id !== submission.user_id && req.user.role !== 'teacher' && req.user.role !== 'admin')
      return res.status(403).json({ ok:false, error:'Forbidden' });

    console.log('Sending file:', filePath);
    res.download(filePath, a.filename);

  } catch (err) {
    console.error('ERROR in GET /attachments/:id/download', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

/* -----------------------------------------------
   4) Grade a submission
   POST /api/submissions/:id/grade
------------------------------------------------ */
router.post('/:id/grade', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin')
      return res.status(403).json({ ok:false, error:'Forbidden' });

    const submission_id = parseInt(req.params.id, 10);
    const { score, feedback } = req.body;

    const r = await db.query(
      `INSERT INTO grades (submission_id, grader_id, score, feedback)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [submission_id, req.user.id, score, feedback]
    );

    await db.query(
      'UPDATE submissions SET status=$1, grade_id=$2 WHERE id=$3',
      ['graded', r.rows[0].id, submission_id]
    );

    console.log('Graded submission', { submission_id, grade: r.rows[0] });
    res.json({ ok:true, grade: r.rows[0] });

  } catch (err) {
    console.error('ERROR in POST /:id/grade', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

module.exports = router;