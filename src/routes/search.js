const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// normalize DB row -> API item
function normalizeRow(row, source = 'materials', score = null) {
  return {
    id: row.id,
    title: row.title,
    subjectId: row.subject_id || null,
    url: row.url || null,
    contentSnippet: row.content ? String(row.content).slice(0, 400) : '',
    source,
    score: score
  };
}

// GET /api/search?q=...&page=...&limit=...
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = Math.min(50, Math.max(5, parseInt(req.query.limit || '10', 10)));
  if (!q) return res.json({ total: 0, page, perPage, results: [] });

  const offset = (page - 1) * perPage;
  const client = await pool.connect();
  try {
    // Primary: FTS on materials.tsv
    const ftsCountSql = `
      SELECT count(*)::int AS total
      FROM materials m
      WHERE m.tsv @@ plainto_tsquery('simple', unaccent($1))
    `;
    const ftsSql = `
      SELECT m.id, m.title, m.subject_id, m.url, m.content,
             ts_rank_cd(m.tsv, plainto_tsquery('simple', unaccent($1))) AS rank
      FROM materials m
      WHERE m.tsv @@ plainto_tsquery('simple', unaccent($1))
      ORDER BY rank DESC, m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const countRes = await client.query(ftsCountSql, [q]);
    const total = (countRes.rows[0] && countRes.rows[0].total) ? countRes.rows[0].total : 0;

    if (total > 0) {
      const r = await client.query(ftsSql, [q, perPage, offset]);
      const rows = r.rows.map(rw => normalizeRow(rw, 'materials', Number(rw.rank)));
      return res.json({ total, page, perPage, results: rows });
    }

    // Fallback: attachments.extracted_text (if you store extracted text)
    const attCountSql = `
      SELECT count(*)::int AS total
      FROM attachments a
      WHERE to_tsvector('simple', coalesce(a.extracted_text,'')) @@ plainto_tsquery('simple', unaccent($1))
    `;
    const c2 = await client.query(attCountSql, [q]);
    const totalAtt = (c2.rows[0] && c2.rows[0].total) ? c2.rows[0].total : 0;
    if (totalAtt > 0) {
      const attSql = `
        SELECT a.id, a.filename as title, a.subject_id, a.storage_key as url, a.extracted_text as content,
               ts_rank_cd(to_tsvector('simple', coalesce(a.extracted_text,'')), plainto_tsquery('simple', unaccent($1))) as rank
        FROM attachments a
        WHERE to_tsvector('simple', coalesce(a.extracted_text,'')) @@ plainto_tsquery('simple', unaccent($1))
        ORDER BY rank DESC
        LIMIT $2 OFFSET $3
      `;
      const r = await client.query(attSql, [q, perPage, offset]);
      const rows = r.rows.map(rw => normalizeRow(rw, 'attachments', Number(rw.rank)));
      return res.json({ total: totalAtt, page, perPage, results: rows });
    }

    // Final fallback: trigram similarity / ILIKE on title
    const trigramCountSql = `
      SELECT count(*)::int AS total
      FROM materials
      WHERE title ILIKE '%' || $1 || '%' OR similarity(title, $1) > 0.25
    `;
    const c3 = await client.query(trigramCountSql, [q]);
    const totalTrig = (c3.rows[0] && c3.rows[0].total) ? c3.rows[0].total : 0;
    const trigramSql = `
      SELECT id, title, subject_id, url, content, similarity(title, $1) AS sim
      FROM materials
      WHERE title ILIKE '%' || $1 || '%' OR similarity(title, $1) > 0.25
      ORDER BY sim DESC NULLS LAST, created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const r3 = await client.query(trigramSql, [q, perPage, offset]);
    const rows = r3.rows.map(rw => normalizeRow(rw, 'materials', Number(rw.sim || 0)));
    return res.json({ total: totalTrig, page, perPage, results: rows });

  } catch (err) {
    console.error('Search error', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/suggest?q=...
router.get('/suggest', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ suggestions: [] });
  const client = await pool.connect();
  try {
    const prefixSql = `
      SELECT id, title, url
      FROM materials
      WHERE title ILIKE $1 || '%'
      ORDER BY created_at DESC
      LIMIT 8
    `;
    const r = await client.query(prefixSql, [q]);
    if (r.rows.length > 0) return res.json({ suggestions: r.rows.map(rw => ({ id: rw.id, title: rw.title, url: rw.url })) });

    const triSql = `
      SELECT id, title, url, similarity(title, $1) AS sim
      FROM materials
      WHERE similarity(title, $1) > 0.2
      ORDER BY sim DESC
      LIMIT 8
    `;
    const r2 = await client.query(triSql, [q]);
    return res.json({ suggestions: r2.rows.map(rw => ({ id: rw.id, title: rw.title, url: rw.url })) });
  } catch (err) {
    console.error('Suggest error', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/reindex -> rebuild tsv column for materials
router.post('/reindex', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE materials
      SET tsv = to_tsvector('simple', unaccent(coalesce(title,'') || ' ' || coalesce(content,'')))
      WHERE true
    `);
    res.json({ ok: true, message: 'reindexed materials' });
  } catch (err) {
    console.error('Reindex error', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;