-- db/all_migrations.sql
-- CLEAN, ROBUST, IDMPOTENT MIGRATION (fixed: reliable insertion logic for subjects)
-- Purpose: create core tables/indexes (safely if missing), ensure subjects table has a usable text column,
-- insert canonical subject rows if missing, and map class -> subjects by grade.
-- Notes:
--  - Defensive: avoids referencing columns that don't exist and avoids failing if objects already exist.
--  - Sets client encoding to UTF8 so psql reads the file correctly.
--  - Idempotent: safe to run multiple times.
--  - Backup your DB before running on production.

SET client_encoding = 'UTF8';

BEGIN;

-- -----------------------
-- 0) Utility: determine a safe default_class_id (used when subjects.class_id is NOT NULL)
-- -----------------------
DO $$
DECLARE
  _default_class_id integer;
BEGIN
  SELECT id INTO _default_class_id FROM classes ORDER BY id LIMIT 1;
  IF _default_class_id IS NULL THEN
    RAISE NOTICE 'No classes found; default_class_id is NULL';
  ELSE
    RAISE NOTICE 'Using default_class_id=%', _default_class_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------
-- 1) Create subjects table if missing (match common schema; safe if already exists)
-- -----------------------
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL DEFAULT 0,
  name text NOT NULL DEFAULT '',
  title text,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure title column exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='subjects' AND column_name='title'
  ) THEN
    ALTER TABLE subjects ADD COLUMN title text;
    RAISE NOTICE 'Added subjects.title column';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------
-- 2) Create class_subjects mapping table if missing (no FKs to avoid dependency issues)
-- -----------------------
CREATE TABLE IF NOT EXISTS class_subjects (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  UNIQUE (class_id, subject_id)
);

-- -----------------------
-- 3) Ensure attachments columns exist (idempotent)
-- -----------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attachments' AND column_name='class_id') THEN
    ALTER TABLE attachments ADD COLUMN class_id integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attachments' AND column_name='drive_parent_folder_id') THEN
    ALTER TABLE attachments ADD COLUMN drive_parent_folder_id integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attachments' AND column_name='category') THEN
    ALTER TABLE attachments ADD COLUMN category text;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------
-- 4) Create indexes if missing (guarded by existence of target table/column)
-- -----------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'class_subjects' AND relkind='r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects (class_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drive_folders' AND column_name='class_subject_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drive_folders_class_subject ON drive_folders (class_subject_id)';
  ELSE
    RAISE NOTICE 'Skipping idx_drive_folders_class_subject: drive_folders.class_subject_id missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attachments' AND column_name='drive_parent_folder_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_attachments_drive_parent ON attachments (drive_parent_folder_id)';
  ELSE
    RAISE NOTICE 'Skipping idx_attachments_drive_parent: attachments.drive_parent_folder_id missing';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------
-- 5) Insert canonical subject rows safely (idempotent)
--    (This block uses explicit branches to avoid mismatched column/value counts.)
-- -----------------------
DO $$
DECLARE
  wanted text[] := ARRAY[
    'Ngữ văn','Toán','Tiếng Anh','Giáo dục công dân','Lịch sử và Địa lí',
    'Khoa học tự nhiên','Công nghệ','Tin học','Lịch sử','Địa lí',
    'Giáo dục kinh tế và pháp luật','Vật lí','Hoá học','Sinh học'
  ];
  has_title boolean;
  has_name boolean;
  has_subject boolean;
  has_class_id boolean;
  match_expr text;
  default_class_id integer;
  subj text;
  i int;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='title') INTO has_title;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='name') INTO has_name;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='subject') INTO has_subject;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='class_id') INTO has_class_id;

  SELECT id INTO default_class_id FROM classes ORDER BY id LIMIT 1;

  -- Determine match expression (use only available columns)
  IF has_title AND has_name THEN
    match_expr := 'COALESCE(title,name)';
  ELSIF has_title THEN
    match_expr := 'title';
  ELSIF has_name THEN
    match_expr := 'name';
  ELSIF has_subject THEN
    match_expr := 'subject';
  ELSE
    RAISE EXCEPTION 'subjects table has no title|name|subject column';
  END IF;

  FOR i IN array_lower(wanted,1)..array_upper(wanted,1) LOOP
    subj := wanted[i];

    -- Cases covering combinations of available columns.
    IF has_name AND has_title AND has_class_id THEN
      EXECUTE format('INSERT INTO subjects(name,title,class_id) SELECT $1,$1,$2 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %s = $1)', match_expr)
        USING subj, COALESCE(default_class_id, 0);
    ELSIF has_name AND has_title AND NOT has_class_id THEN
      EXECUTE format('INSERT INTO subjects(name,title) SELECT $1,$1 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %s = $1)', match_expr)
        USING subj;
    ELSIF has_name AND NOT has_title AND has_class_id THEN
      EXECUTE format('INSERT INTO subjects(name,class_id) SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %s = $1)', match_expr)
        USING subj, COALESCE(default_class_id, 0);
    ELSIF has_name AND NOT has_title AND NOT has_class_id THEN
      EXECUTE format('INSERT INTO subjects(name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %s = $1)', match_expr)
        USING subj;
    ELSIF has_title AND NOT has_name AND has_class_id THEN
      EXECUTE format('INSERT INTO subjects(title,class_id) SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %s = $1)', match_expr)
        USING subj, COALESCE(default_class_id, 0);
    ELSIF has_title AND NOT has_name AND NOT has_class_id THEN
      EXECUTE format('INSERT INTO subjects(title) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %s = $1)', match_expr)
        USING subj;
    ELSIF NOT has_name AND NOT has_title AND has_subject AND has_class_id THEN
      EXECUTE format('INSERT INTO subjects(subject,class_id) SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %s = $1)', match_expr)
        USING subj, COALESCE(default_class_id, 0);
    ELSIF NOT has_name AND NOT has_title AND has_subject AND NOT has_class_id THEN
      EXECUTE format('INSERT INTO subjects(subject) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %s = $1)', match_expr)
        USING subj;
    ELSE
      -- No suitable column to insert; skip and notice
      RAISE NOTICE 'Skipping insert for subject "%" because no suitable target column exists', subj;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- -----------------------
-- 6) Create a normalized temporary subjects map (id, title) using only existing columns
-- -----------------------
DO $$
DECLARE
  cols text[] := ARRAY[]::text[];
  expr text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='title') THEN cols := array_append(cols,'title'); END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='name') THEN cols := array_append(cols,'name'); END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='subject') THEN cols := array_append(cols,'subject'); END IF;

  IF array_length(cols,1) IS NULL THEN
    RAISE EXCEPTION 'subjects table missing title|name|subject';
  END IF;

  IF array_length(cols,1) = 1 THEN
    expr := cols[1];
  ELSE
    expr := 'COALESCE(' || array_to_string(cols, ',') || ')';
  END IF;

  EXECUTE format('DROP TABLE IF EXISTS tmp_subjects_map; CREATE TEMP TABLE tmp_subjects_map AS SELECT id, %s::text AS title FROM subjects;', expr);
END;
$$ LANGUAGE plpgsql;

-- -----------------------
-- 7) Build reusable temporary table of classes with numeric grade extracted
-- -----------------------
DROP TABLE IF EXISTS tmp_class_with_grade;
CREATE TEMP TABLE tmp_class_with_grade AS
SELECT id, name, (substring(name from '([0-9]{1,2})'))::int AS grade
FROM classes
WHERE substring(name from '([0-9]{1,2})') IS NOT NULL;

-- -----------------------
-- 8) Insert mapping for grades 6..9
-- -----------------------
INSERT INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id
FROM tmp_class_with_grade c
JOIN tmp_subjects_map s ON s.title IN (
  'Ngữ văn','Toán','Tiếng Anh','Giáo dục công dân','Lịch sử và Địa lí',
  'Khoa học tự nhiên','Công nghệ','Tin học'
)
WHERE c.grade BETWEEN 6 AND 9
  AND NOT EXISTS (
    SELECT 1 FROM class_subjects cs WHERE cs.class_id = c.id AND cs.subject_id = s.id
  );

-- -----------------------
-- 9) Insert mapping for grades 10..12 (exclude Thể chất & Quốc phòng)
-- -----------------------
INSERT INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id
FROM tmp_class_with_grade c
JOIN tmp_subjects_map s ON s.title IN (
  'Ngữ văn','Toán','Tiếng Anh','Lịch sử','Địa lí','Giáo dục kinh tế và pháp luật',
  'Vật lí','Hoá học','Sinh học','Công nghệ','Tin học'
)
WHERE c.grade BETWEEN 10 AND 12
  AND NOT EXISTS (
    SELECT 1 FROM class_subjects cs WHERE cs.class_id = c.id AND cs.subject_id = s.id
  );

-- -----------------------
-- 10) Final maintenance
-- -----------------------
ANALYZE VERBOSE subjects;
ANALYZE VERBOSE class_subjects;
ANALYZE VERBOSE classes;

COMMIT;