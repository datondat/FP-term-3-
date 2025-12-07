-- db/all_migrations.sql
-- Combined migrations: drive_folders, class_subjects, add columns, subjects seed, indexes.
-- Idempotent: safe to run multiple times.

-- 1) drive_folders table (map class -> subject -> drive folder id)
CREATE TABLE IF NOT EXISTS drive_folders (
  id SERIAL PRIMARY KEY,
  class_id INTEGER,
  subject_id INTEGER,
  drive_folder_id TEXT NOT NULL,
  path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (class_id, subject_id)
);

-- 2) class_subjects mapping table
CREATE TABLE IF NOT EXISTS class_subjects (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE (class_id, subject_id)
);

-- 3) Add columns to attachments (if missing)
ALTER TABLE IF EXISTS attachments
  ADD COLUMN IF NOT EXISTS class_id INTEGER,
  ADD COLUMN IF NOT EXISTS drive_parent_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- 4) Ensure required indexes
CREATE INDEX IF NOT EXISTS idx_drive_folders_class_subject ON drive_folders(class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_attachments_drive_parent ON attachments(drive_parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id);

-- 5) Insert subjects used for grade groups (only if missing)
WITH wanted(subject) AS (
  VALUES
    ('Ngữ văn'),
    ('Toán'),
    ('Tiếng Anh'),
    ('Giáo dục công dân'),
    ('Lịch sử và Địa lí'),
    ('Khoa học tự nhiên'),
    ('Công nghệ'),
    ('Tin học'),
    ('Lịch sử'),
    ('Địa lí'),
    ('Giáo dục kinh tế và pháp luật'),
    ('Vật lí'),
    ('Hoá học'),
    ('Sinh học')
)
INSERT INTO subjects (title)
SELECT subject FROM wanted w
WHERE NOT EXISTS (SELECT 1 FROM subjects s WHERE s.title = w.subject);

-- 6) Map class -> subjects for classes 6..9 (assumes classes.name starts with digit 6..9)
INSERT INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id
FROM classes c
CROSS JOIN subjects s
WHERE c.name ~ '^[6-9]'
  AND s.title IN (
    'Ngữ văn',
    'Toán',
    'Tiếng Anh',
    'Giáo dục công dân',
    'Lịch sử và Địa lí',
    'Khoa học tự nhiên',
    'Công nghệ',
    'Tin học'
  )
  AND NOT EXISTS (
    SELECT 1 FROM class_subjects cs WHERE cs.class_id = c.id AND cs.subject_id = s.id
  );

-- 7) Map class -> subjects for classes 10..12 (assumes classes.name starts with 10,11,12)
INSERT INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id
FROM classes c
CROSS JOIN subjects s
WHERE c.name ~ '^(10|11|12)'
  AND s.title IN (
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
  AND NOT EXISTS (
    SELECT 1 FROM class_subjects cs WHERE cs.class_id = c.id AND cs.subject_id = s.id
  );

-- 8) Analyze (optional but helpful)
ANALYZE classes;
ANALYZE subjects;
ANALYZE class_subjects;
ANALYZE attachments;
ANALYZE drive_folders;