-- db/fix_subjects_and_mappings.sql
-- Robust fix: insert missing subjects (using actual text column), create tmp_subjects_map and tmp_class_with_grade,
-- then map class -> subjects for grades 6..9 and 10..12 (idempotent).
SET client_encoding = 'UTF8';

BEGIN;

-- 1) Insert missing subjects safely (use default_class_id to satisfy NOT NULL if present)
DO $$
DECLARE
  wanted text[] := ARRAY[
    'Ngữ văn','Toán','Tiếng Anh','Giáo dục công dân','Lịch sử và Địa lí',
    'Khoa học tự nhiên','Công nghệ','Tin học','Lịch sử','Địa lí',
    'Giáo dục kinh tế và pháp luật','Vật lí','Hoá học','Sinh học'
  ];
  col text;
  subj text;
  default_class_id integer;
  sql text;
BEGIN
  SELECT id INTO default_class_id FROM classes ORDER BY id LIMIT 1;
  IF default_class_id IS NULL THEN
    RAISE EXCEPTION 'No classes found; create at least one class before running this script.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='title') THEN
    col := 'title';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='name') THEN
    col := 'name';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='subject') THEN
    col := 'subject';
  ELSE
    RAISE EXCEPTION 'subjects table missing title|name|subject column';
  END IF;

  FOR i IN array_lower(wanted,1)..array_upper(wanted,1) LOOP
    subj := wanted[i];
    sql := format('INSERT INTO subjects(%I, class_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %I = $1)', col, col);
    EXECUTE sql USING subj, default_class_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2) Create normalized temporary subjects map (id, title)
DO $$
DECLARE
  col text;
  create_sql text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='title') THEN
    col := 'title';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='name') THEN
    col := 'name';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='subject') THEN
    col := 'subject';
  ELSE
    RAISE EXCEPTION 'subjects table missing title|name|subject column';
  END IF;

  EXECUTE format('DROP TABLE IF EXISTS tmp_subjects_map; CREATE TEMP TABLE tmp_subjects_map AS SELECT id, %I::text AS title FROM subjects;', col);
END;
$$ LANGUAGE plpgsql;

-- 3) Create a temporary table for classes with extracted grade so it can be reused
DROP TABLE IF EXISTS tmp_class_with_grade;
CREATE TEMP TABLE tmp_class_with_grade AS
SELECT id, name, (substring(name from '([0-9]{1,2})'))::int AS grade
FROM classes
WHERE substring(name from '([0-9]{1,2})') IS NOT NULL;

-- 4) Insert mappings for grades 6..9
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

-- 5) Insert mappings for grades 10..12 (exclude Thể chất & Quốc phòng)
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

COMMIT;