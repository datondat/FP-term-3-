const express = require('express');
const router = express.Router();
const { pool } = require('../db');

/**
 * Detect which column name is used for "grade/class" in a table.
 * Checks common candidates in information_schema and returns first match.
 */
async function detectGradeColumn(client, tableName) {
  const candidates = ['class_id', 'class', 'grade', 'class_name', 'classid'];
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = ANY($2::text[])
    LIMIT 1
  `;
  const res = await client.query(sql, [tableName, candidates]);
  if (res.rows[0] && res.rows[0].column_name) return res.rows[0].column_name;
  return null;
}

/**
 * Normalize DB row into API result shape
 */
function normalizeRow(row, source = 'materials', score = null) {
  return {
    id: row.id,
    title: row.title,
    subjectId: row.subject_id || null,
    url: row.url || row.storage_key || null,
    contentSnippet: row.content ? String(row.content).slice(0, 400) : (row.extracted_text ? String(row.extracted_text).slice(0,400) : ''),
    source,
    score: score
  };
}

/**
 * Build dynamic joins/where parts for filters.
 * Uses detected grade column name (gradeCol) if provided.
 */
function buildFilters({ subjectFilter, gradeFilter, gradeCol }, paramStartIndex = 1) {
  const joins = [];
  const whereParts = [];
  const values = [];

  if (subjectFilter) {
    if (/^\d+$/.test(String(subjectFilter).trim())) {
      values.push(parseInt(subjectFilter, 10));
      whereParts.push(`m.subject_id = $${paramStartIndex + values.length - 1}`);
    } else {
      // join subjects table to filter by subject title
      joins.push(`LEFT JOIN subjects s ON m.subject_id = s.id`);
      values.push(`%${subjectFilter}%`);
      whereParts.push(`lower(s.title) LIKE lower($${paramStartIndex + values.length - 1})`);
    }
  }

  if (gradeFilter) {
    if (gradeCol) {
      if (/^\d+$/.test(String(gradeFilter).trim())) {
        values.push(parseInt(gradeFilter, 10));
        whereParts.push(`m.${gradeCol} = $${paramStartIndex + values.length - 1}`);
      } else {
        values.push(`%${gradeFilter}%`);
        whereParts.push(`CAST(m.${gradeCol} AS text) ILIKE $${paramStartIndex + values.length - 1}`);
      }
    } else {
      // grade column not detected on materials: fall back to join classes table (best-effort)
      if (/^\d+$/.test(String(gradeFilter).trim())) {
        values.push(parseInt(gradeFilter, 10));
        whereParts.push(`m.class_id = $${paramStartIndex + values.length - 1}`); // may not exist, but detection should prevent this in most deployments
      } else {
        joins.push(`LEFT JOIN classes c ON m.class_id = c.id`);
        values.push(`%${gradeFilter}%`);
        whereParts.push(`lower(c.name) LIKE lower($${paramStartIndex + values.length - 1})`);
      }
    }
  }

  return {
    joins: joins.join(' '),
    where: whereParts.length ? (' AND ' + whereParts.join(' AND ')) : '',
    values
  };
}

/**
 * GET /api/search?q=...&page=...&limit=... [&subject=...&grade=...]
 *
 * Behavior:
 * - If q present: perform FTS against materials (m.tsv) first, fallback to attachments.
 * - If q absent: perform filter-only (materials with filters), fallback to attachments.
 * - Attempts to detect grade column names in materials/attachments tables to avoid SQL errors.
 */
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = Math.min(100, Math.max(5, parseInt(req.query.limit || '10', 10)));
  const subjectFilter = req.query.subject ? String(req.query.subject).trim() : null;
  const gradeFilter = req.query.grade ? String(req.query.grade).trim() : null;

  const offset = (page - 1) * perPage;
  const client = await pool.connect();
  try {
    // detect grade-like columns to avoid assuming m.class_id exists
    const gradeColMaterials = await detectGradeColumn(client, 'materials'); // e.g. 'class_id' or 'class' or 'grade'
    const gradeColAttachments = await detectGradeColumn(client, 'attachments');

    if (q) {
      // ---- Full-text search path ----
      const filterInfo = buildFilters({ subjectFilter, gradeFilter, gradeCol: gradeColMaterials }, 2); // $1 reserved for q
      const extraJoins = filterInfo.joins;
      const extraWhere = filterInfo.where;
      const extraValues = filterInfo.values || [];

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

      // count
      const countRes = await client.query(ftsCountSql, [q, ...extraValues]);
      const total = (countRes.rows[0] && countRes.rows[0].total) ? countRes.rows[0].total : 0;
      if (total > 0) {
        const r = await client.query(ftsSql, [q, ...extraValues, perPage, offset]);
        const rows = r.rows.map(rw => normalizeRow(rw, 'materials', Number(rw.rank)));
        return res.json({ total, page, perPage, results: rows });
      }

      // fallback to attachments (search extracted_text)
      const attFilterParts = [];
      const attValues = [];
      if (subjectFilter) {
        if (/^\d+$/.test(subjectFilter)) {
          attValues.push(parseInt(subjectFilter, 10));
          attFilterParts.push(`a.subject_id = $${1 + attValues.length}`);
        } else {
          attValues.push(`%${subjectFilter}%`);
          attFilterParts.push(`EXISTS (SELECT 1 FROM subjects s2 WHERE s2.id = a.subject_id AND lower(s2.title) LIKE lower($${1 + attValues.length}))`);
        }
      }
      if (gradeFilter) {
        if (gradeColAttachments) {
          if (/^\d+$/.test(String(gradeFilter).trim())) {
            attValues.push(parseInt(gradeFilter, 10));
            attFilterParts.push(`a.${gradeColAttachments} = $${1 + attValues.length}`);
          } else {
            attValues.push(`%${gradeFilter}%`);
            attFilterParts.push(`CAST(a.${gradeColAttachments} AS text) ILIKE $${1 + attValues.length}`);
          }
        } else {
          if (/^\d+$/.test(gradeFilter)) {
            attValues.push(parseInt(gradeFilter, 10));
            attFilterParts.push(`a.class_id = $${1 + attValues.length}`);
          } else {
            attValues.push(`%${gradeFilter}%`);
            attFilterParts.push(`EXISTS (SELECT 1 FROM classes c2 WHERE c2.id = a.class_id AND lower(c2.name) LIKE lower($${1 + attValues.length}))`);
          }
        }
      }
      const attWhereExtra = attFilterParts.length ? ' AND ' + attFilterParts.join(' AND ') : '';

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

      const countRes2 = await client.query(attCountSql, [q, ...attValues]);
      const totalAtt = (countRes2.rows[0] && countRes2.rows[0].total) ? countRes2.rows[0].total : 0;
      if (totalAtt > 0) {
        const r = await client.query(attSql, [q, perPage, offset, ...attValues]);
        const rows = r.rows.map(rw => normalizeRow(rw, 'attachments', Number(rw.rank)));
        return res.json({ total: totalAtt, page, perPage, results: rows });
      }

      return res.json({ total: 0, page, perPage, results: [] });
    } else {
      // ---- FILTER-ONLY path (no q) ----
      const filterInfo = buildFilters({ subjectFilter, gradeFilter, gradeCol: gradeColMaterials }, 1); // params start at $1
      const extraJoins = filterInfo.joins;
      const extraWhere = filterInfo.where;
      const extraValues = filterInfo.values || [];

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

      const countRes = await client.query(countSql, [...extraValues]);
      const total = (countRes.rows[0] && countRes.rows[0].total) ? countRes.rows[0].total : 0;
      if (total === 0) {
        // try attachments with similar filters
        const attWhereParts = [];
        const attVals = [];
        if (subjectFilter) {
          if (/^\d+$/.test(subjectFilter)) {
            attVals.push(parseInt(subjectFilter, 10));
            attWhereParts.push(`a.subject_id = $${1 + attVals.length}`);
          } else {
            attVals.push(`%${subjectFilter}%`);
            attWhereParts.push(`EXISTS (SELECT 1 FROM subjects s2 WHERE s2.id = a.subject_id AND lower(s2.title) LIKE lower($${1 + attVals.length}))`);
          }
        }
        if (gradeFilter) {
          if (gradeColAttachments) {
            if (/^\d+$/.test(String(gradeFilter).trim())) {
              attVals.push(parseInt(gradeFilter, 10));
              attWhereParts.push(`a.${gradeColAttachments} = $${1 + attVals.length}`);
            } else {
              attVals.push(`%${gradeFilter}%`);
              attWhereParts.push(`CAST(a.${gradeColAttachments} AS text) ILIKE $${1 + attVals.length}`);
            }
          } else {
            if (/^\d+$/.test(gradeFilter)) {
              attVals.push(parseInt(gradeFilter, 10));
              attWhereParts.push(`a.class_id = $${1 + attVals.length}`);
            } else {
              attVals.push(`%${gradeFilter}%`);
              attWhereParts.push(`EXISTS (SELECT 1 FROM classes c2 WHERE c2.id = a.class_id AND lower(c2.name) LIKE lower($${1 + attVals.length}))`);
            }
          }
        }
        const attWhereExtra = attWhereParts.length ? ' AND ' + attWhereParts.join(' AND ') : '';
        const attCountSql = `SELECT count(*)::int AS total FROM attachments a WHERE 1=1 ${attWhereExtra}`;
        const attSql = `SELECT a.id, a.filename as title, a.subject_id, a.storage_key as url, a.extracted_text as content FROM attachments a WHERE 1=1 ${attWhereExtra} ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`;

        const countRes2 = await client.query(attCountSql, attVals);
        const totalAtt = (countRes2.rows[0] && countRes2.rows[0].total) ? countRes2.rows[0].total : 0;
        if (totalAtt === 0) return res.json({ total: 0, page, perPage, results: [] });
        const r2 = await client.query(attSql, [perPage, offset, ...attVals]);
        const rows2 = r2.rows.map(rw => normalizeRow(rw, 'attachments', null));
        return res.json({ total: totalAtt, page, perPage, results: rows2 });
      } else {
        const r = await client.query(dataSql, [...extraValues, perPage, offset]);
        const rows = r.rows.map(rw => normalizeRow(rw, 'materials', null));
        return res.json({ total, page, perPage, results: rows });
      }
    }
  } catch (err) {
    console.error('search route error', err);
    // return structured error to frontend (avoid exposing stack)
    return res.status(500).json({ error: err.message || String(err) });
  } finally {
    client.release();
  }
});

module.exports = router;