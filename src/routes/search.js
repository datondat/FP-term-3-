// src/routes/search.js
// Robust /api/search: detect grade/class column and avoid referencing m.class_id when absent.
// Supports full-text search (q) and filter-only (grade/subject). Falls back to attachments when materials return no results.
// Includes logging to verify this version is running.

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

/* Detect grade-like column names in a table */
async function detectGradeColumn(client, tableName) {
  const candidates = ['class_id','classid','class','grade','grade_id','class_name','klass','classId'];
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = ANY($2::text[])
    LIMIT 1
  `;
  try {
    const r = await client.query(sql, [tableName, candidates]);
    return (r.rows[0] && r.rows[0].column_name) ? r.rows[0].column_name : null;
  } catch (e) {
    console.warn(`[SEARCH] detectGradeColumn failed for ${tableName}:`, e && e.message);
    return null;
  }
}

/* Normalize rows for API output */
function normalizeRow(row, source='materials', score=null) {
  return {
    id: row.id,
    title: row.title,
    subjectId: row.subject_id || null,
    url: row.url || row.storage_key || null,
    contentSnippet: row.content ? String(row.content).slice(0,400) : (row.extracted_text ? String(row.extracted_text).slice(0,400) : ''),
    source,
    score
  };
}

/* Build filters for materials — DO NOT reference m.class_id if gradeCol is not provided. */
function buildMaterialFilters({ subjectFilter, gradeFilter, gradeCol }, paramStartIndex=1) {
  const joins = [];
  const where = [];
  const values = [];

  if (subjectFilter) {
    if (/^\d+$/.test(String(subjectFilter).trim())) {
      values.push(parseInt(subjectFilter,10));
      where.push(`m.subject_id = $${paramStartIndex + values.length - 1}`);
    } else {
      joins.push(`LEFT JOIN subjects s ON m.subject_id = s.id`);
      values.push(`%${subjectFilter}%`);
      where.push(`lower(s.title) LIKE lower($${paramStartIndex + values.length - 1})`);
    }
  }

  // only apply grade filter on materials if gradeCol is detected
  if (gradeFilter && gradeCol) {
    if (/^\d+$/.test(String(gradeFilter).trim())) {
      values.push(parseInt(gradeFilter,10));
      where.push(`m.${gradeCol} = $${paramStartIndex + values.length - 1}`);
    } else {
      values.push(`%${gradeFilter}%`);
      where.push(`CAST(m.${gradeCol} AS text) ILIKE $${paramStartIndex + values.length - 1}`);
    }
  }

  return { joins: joins.join(' '), where: where.length ? (' AND ' + where.join(' AND ')) : '', values };
}

/* Build filter parts for attachments (apply grade if attachments has grade column) */
function buildAttachmentFilterParts({ subjectFilter, gradeFilter, gradeColAttachments }) {
  const parts = [];
  const vals = [];

  if (subjectFilter) {
    if (/^\d+$/.test(String(subjectFilter).trim())) {
      vals.push(parseInt(subjectFilter,10));
      parts.push(`a.subject_id = $${vals.length}`);
    } else {
      vals.push(`%${subjectFilter}%`);
      parts.push(`EXISTS (SELECT 1 FROM subjects s2 WHERE s2.id = a.subject_id AND lower(s2.title) LIKE lower($${vals.length}))`);
    }
  }

  if (gradeFilter) {
    if (gradeColAttachments) {
      if (/^\d+$/.test(String(gradeFilter).trim())) {
        vals.push(parseInt(gradeFilter,10));
        parts.push(`a.${gradeColAttachments} = $${vals.length}`);
      } else {
        vals.push(`%${gradeFilter}%`);
        parts.push(`CAST(a.${gradeColAttachments} AS text) ILIKE $${vals.length}`);
      }
    } else {
      // attachments don't have grade column -> skip grade filter for attachments
    }
  }

  return { parts, vals };
}

/**
 * GET /api/search
 * Query params:
 *  - q: optional full text query
 *  - page, limit
 *  - subject: optional subject id or substring
 *  - grade: optional grade/class filter
 */
router.get('/search', async (req,res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = Math.min(100, Math.max(5, parseInt(req.query.limit || '10', 10)));
  const subjectFilter = req.query.subject ? String(req.query.subject).trim() : null;
  const gradeFilter = req.query.grade ? String(req.query.grade).trim() : null;
  const offset = (page-1)*perPage;

  const client = await pool.connect();
  try {
    // detect grade columns
    const gradeColMaterials = await detectGradeColumn(client, 'materials');
    const gradeColAttachments = await detectGradeColumn(client, 'attachments');

    // log for verification
    console.info('[SEARCH] incoming', { q: q || null, subjectFilter, gradeFilter, page, perPage });
    console.info('[SEARCH] detected grade columns', { gradeColMaterials, gradeColAttachments });

    if (q) {
      // FTS path against materials (apply grade only if detected)
      const mFilter = buildMaterialFilters({ subjectFilter, gradeFilter, gradeCol: gradeColMaterials }, 2);
      const extraJoins = mFilter.joins;
      const extraWhere = mFilter.where;
      const extraValues = mFilter.values || [];

      const ftsCountSql = `
        SELECT count(*)::int AS total
        FROM materials m
        ${extraJoins}
        WHERE m.tsv @@ plainto_tsquery('simple', unaccent($1))
        ${extraWhere}
      `;
      const ftsSql = `
        SELECT m.id, m.title, m.subject_id, m.url, m.content,
               ts_rank_cd(m.tsv, plainto_tsquery('simple', unaccent($1))) AS rank
        FROM materials m
        ${extraJoins}
        WHERE m.tsv @@ plainto_tsquery('simple', unaccent($1))
        ${extraWhere}
        ORDER BY rank DESC, m.created_at DESC
        LIMIT $${2 + extraValues.length} OFFSET $${3 + extraValues.length}
      `;

      const cnt = await client.query(ftsCountSql, [q, ...extraValues]);
      const total = (cnt.rows[0] && cnt.rows[0].total) ? cnt.rows[0].total : 0;
      if (total > 0) {
        const r = await client.query(ftsSql, [q, ...extraValues, perPage, offset]);
        const rows = r.rows.map(rw => normalizeRow(rw, 'materials', Number(rw.rank)));
        return res.json({ total, page, perPage, results: rows });
      }

      // fallback to attachments
      const attBuild = buildAttachmentFilterParts({ subjectFilter, gradeFilter, gradeColAttachments });
      const attWhereExtra = attBuild.parts.length ? (' AND ' + attBuild.parts.join(' AND ')) : '';

      const attCountSql = `
        SELECT count(*)::int AS total
        FROM attachments a
        WHERE to_tsvector('simple', coalesce(a.extracted_text,'')) @@ plainto_tsquery('simple', unaccent($1))
        ${attWhereExtra}
      `;
      const attSql = `
        SELECT a.id, a.filename as title, a.subject_id, a.storage_key as url, a.extracted_text as content,
               ts_rank_cd(to_tsvector('simple', coalesce(a.extracted_text,'')), plainto_tsquery('simple', unaccent($1))) as rank
        FROM attachments a
        WHERE to_tsvector('simple', coalesce(a.extracted_text,'')) @@ plainto_tsquery('simple', unaccent($1))
        ${attWhereExtra}
        ORDER BY rank DESC, a.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const cnt2 = await client.query(attCountSql, [q, ...attBuild.vals]);
      const totalAtt = (cnt2.rows[0] && cnt2.rows[0].total) ? cnt2.rows[0].total : 0;
      if (totalAtt > 0) {
        const r = await client.query(attSql, [q, perPage, offset, ...attBuild.vals]);
        const rows = r.rows.map(rw => normalizeRow(rw, 'attachments', Number(rw.rank)));
        return res.json({ total: totalAtt, page, perPage, results: rows });
      }

      return res.json({ total:0, page, perPage, results: [] });
    } else {
      // filter-only path (do not reference m.class_id unless detected)
      const mFilter = buildMaterialFilters({ subjectFilter, gradeFilter, gradeCol: gradeColMaterials }, 1);
      const extraJoins = mFilter.joins;
      const extraWhere = mFilter.where;
      const extraValues = mFilter.values || [];

      const countSql = `
        SELECT count(*)::int AS total
        FROM materials m
        ${extraJoins}
        WHERE 1=1
        ${extraWhere}
      `;
      const dataSql = `
        SELECT m.id, m.title, m.subject_id, m.url, m.content
        FROM materials m
        ${extraJoins}
        WHERE 1=1
        ${extraWhere}
        ORDER BY m.created_at DESC
        LIMIT $${1 + extraValues.length} OFFSET $${2 + extraValues.length}
      `;

      const cnt = await client.query(countSql, [...extraValues]);
      const total = (cnt.rows[0] && cnt.rows[0].total) ? cnt.rows[0].total : 0;

      if (total > 0) {
        const r = await client.query(dataSql, [...extraValues, perPage, offset]);
        const rows = r.rows.map(rw => normalizeRow(rw, 'materials', null));
        return res.json({ total, page, perPage, results: rows });
      }

      // fallback to attachments (apply grade if attachments supports it)
      const attBuild = buildAttachmentFilterParts({ subjectFilter, gradeFilter, gradeColAttachments });
      const attWhereExtra = attBuild.parts.length ? (' AND ' + attBuild.parts.join(' AND ')) : '';
      const attCountSql = `SELECT count(*)::int AS total FROM attachments a WHERE 1=1 ${attWhereExtra}`;
      const attSql = `SELECT a.id, a.filename as title, a.subject_id, a.storage_key as url, a.extracted_text as content FROM attachments a WHERE 1=1 ${attWhereExtra} ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`;

      const cnt2 = await client.query(attCountSql, attBuild.vals);
      const totalAtt = (cnt2.rows[0] && cnt2.rows[0].total) ? cnt2.rows[0].total : 0;
      if (totalAtt > 0) {
        const r2 = await client.query(attSql, [perPage, offset, ...attBuild.vals]);
        const rows2 = r2.rows.map(rw => normalizeRow(rw, 'attachments', null));
        return res.json({ total: totalAtt, page, perPage, results: rows2 });
      }

      return res.json({ total:0, page, perPage, results: [] });
    }

  } catch (err) {
    console.error('[SEARCH] error', err);
    return res.status(500).json({ error: err.message || String(err) });
  } finally {
    client.release();
  }
});

module.exports = router;