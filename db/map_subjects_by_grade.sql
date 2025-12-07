-- db/map_subjects_by_grade.sql
-- Robust version: detect which text column exists in subjects (title|name|subject),
-- insert missing subjects with a safe default_class_id, and then map class->subjects by grade.
-- Save this file as UTF-8 before running.

SET client_encoding = 'UTF8';

BEGIN;

-- Part A: insert missing subject names (provide a default class_id so NOT NULL is satisfied)
DO $$
DECLARE
  wanted text[] := ARRAY[
    'Ngữ văn','Toán','Tiếng Anh','Giáo dục công dân','Lịch sử và Địa lí',
    'Khoa học tự nhiên','Công nghệ','Tin học','Lịch sử','Địa lí',
    'Giáo dục kinh tế và pháp luật','Vật lí','Hoá học','Sinh học'
  ];
  colname text;
  subj text;
  default_class_id integer;
BEGIN
  -- choose a safe default class id (first existing class)
  SELECT id INTO default_class_id FROM classes ORDER BY id LIMIT 1;
  IF default_class_id IS NULL THEN
    RAISE EXCEPTION 'No classes found in classes table; create at least one class before running this script.';
  END IF;

  -- detect which column exists in subjects table for the title text
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='title') THEN
    colname := 'title';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='name') THEN
    colname := 'name';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='subject') THEN
    colname := 'subject';
  ELSE
    RAISE EXCEPTION 'table subjects does not have a recognized text column (title|name|subject).';
  END IF;

  FOREACH subj IN ARRAY wanted LOOP
    -- Insert row only if not exists. Provide class_id = default_class_id to satisfy NOT NULL constraint.
    EXECUTE format(
      'INSERT INTO subjects(%I, class_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE %I = $1)',
      colname, colname
    ) USING subj, default_class_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Part B: create a normalized temporary subjects map using dynamic SQL (safe if only one of the columns exists)
DO $$
DECLARE
  colname text;
  create_sql text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='title') THEN
    colname := 'title';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='name') THEN
    colname := 'name';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='subject') THEN
    colname := 'subject';
  ELSE
    RAISE EXCEPTION 'table subjects missing title|name|subject column';
  END IF;

  -- drop temp if exists and create with the detected column as "title"
  EXECUTE format('DROP TABLE IF EXISTS tmp_subjects_map; CREATE TEMP TABLE tmp_subjects_map AS SELECT id, %I AS title FROM subjects;', colname);
END;
$$ LANGUAGE plpgsql;

-- Part C: build classes with extracted grade (first numeric substring)
WITH class_with_grade AS (
  SELECT id, name, (substring(name from '([0-9]{1,2})'))::int AS grade
  FROM classes
  WHERE substring(name from '([0-9]{1,2})') IS NOT NULL
)

-- Part D: map 6..9
INSERT INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id
FROM class_with_grade c
JOIN tmp_subjects_map s ON s.title IN (
    'Ngữ văn',
    'Toán',
    'Tiếng Anh',
    'Giáo dục công dân',
    'Lịch sử và Địa lí',
    'Khoa học tự nhiên',
    'Công nghệ',
    'Tin học'
)
WHERE c.grade BETWEEN 6 AND 9
  AND NOT EXISTS (
    SELECT 1 FROM class_subjects cs WHERE cs.class_id = c.id AND cs.subject_id = s.id
  );

-- Part E: map 10..12 (exclude Thể chất & Quốc phòng)
INSERT INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id
FROM class_with_grade c
JOIN tmp_subjects_map s ON s.title IN (
    'Ngữ văn',
    'Toán',
    'Tiếng Anh',
    'Lịch sử',
    'Địa lí',
    'Giáo dục kinh tế và pháp luật',
    'Vật lí',
    'Hoá học',
    'Sinh học',
    'Công nghệ',
    'Tin học'
)
WHERE c.grade BETWEEN 10 AND 12
  AND NOT EXISTS (
    SELECT 1 FROM class_subjects cs WHERE cs.class_id = c.id AND cs.subject_id = s.id
  );

COMMIT;