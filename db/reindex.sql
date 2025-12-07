-- db/reindex.sql
-- Regenerate tsvector for materials and rebuild search indexes.
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run this file with psql (do NOT wrap in BEGIN/COMMIT).

/* 1) Regenerate tsv column for materials (force recompute) */
UPDATE materials
SET tsv = to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))
WHERE true;

/* 2) Optionally touch title/content to fire trigger if you prefer:
   UPDATE materials SET title = title WHERE true;
   But above explicit UPDATE covers it.
*/

/* 3) Rebuild / (re)create GIN indexes for full-text and trigram.
   We drop existing and recreate concurrently to avoid locking reads.
   If your Postgres version/permissions don't allow CONCURRENTLY, use the _no_concurrent file.
*/

/* Materials full-text index (GIN on tsv) */
DROP INDEX IF EXISTS materials_tsv_idx;
CREATE INDEX CONCURRENTLY materials_tsv_idx ON materials USING GIN (tsv);

/* Trigram index on title for similarity/ILIKE */
DROP INDEX IF EXISTS materials_title_trgm;
CREATE INDEX CONCURRENTLY materials_title_trgm ON materials USING GIN (title gin_trgm_ops);

/* Attachments: index on extracted_text expression */
DROP INDEX IF EXISTS attachments_text_tsv_idx;
CREATE INDEX CONCURRENTLY attachments_text_tsv_idx ON attachments USING GIN (to_tsvector('simple', coalesce(extracted_text, '')));

/* 4) ANALYZE to update planner statistics */
ANALYZE materials;
ANALYZE attachments;