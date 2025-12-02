-- assignments_fixed.sql
-- PhiÃªn báº£n sá»­a Ä‘á»ƒ trÃ¡nh FK vÃ²ng vÃ  tÆ°Æ¡ng thÃ­ch import theo thá»© tá»±

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Questions
CREATE TABLE IF NOT EXISTS assignment_questions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
  question_text TEXT,
  question_type TEXT DEFAULT 'file'
);

-- Submissions: táº¡o trÆ°á»›c, nhÆ°ng KHÃ”NG thÃªm FK trá»±c tiáº¿p trÃªn grade_id (thÃªm sau báº±ng ALTER)
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  grade_id INTEGER
);

-- Submission attachments
CREATE TABLE IF NOT EXISTS submission_attachments (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grades: tham chiáº¿u submissions.id (submission Ä‘Ã£ tá»“n táº¡i)
CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
  grader_id INTEGER REFERENCES users(id),
  score NUMERIC,
  feedback TEXT,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index/opt
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);

-- Sau khi cáº£ hai báº£ng tá»“n táº¡i, thÃªm FK cho submissions.grade_id trá» tá»›i grades.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_grade_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE submissions ADD CONSTRAINT submissions_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE SET NULL';
  END IF;
END
$$;