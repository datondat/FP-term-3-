BEGIN;

-- Ensure extensions (must be run by a superuser or a user with CREATE EXTENSION privilege)
-- If you get permission errors, run these as the postgres superuser.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);

-- Materials (main content)
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tsv tsvector
);

-- Trigger function to keep tsv column up-to-date
CREATE OR REPLACE FUNCTION materials_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('simple', unaccent(coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,'')));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Remove existing trigger if present, then create
DROP TRIGGER IF EXISTS tsv_update ON materials;
CREATE TRIGGER tsv_update BEFORE INSERT OR UPDATE
  ON materials FOR EACH ROW EXECUTE PROCEDURE materials_tsv_trigger();

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS materials_tsv_idx ON materials USING GIN (tsv);
CREATE INDEX IF NOT EXISTS materials_title_trgm ON materials USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS subjects_class_idx ON subjects (class_id);

-- Attachments (file uploads + optional extracted text for full-text search)
CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  file_size bigint,
  uploaded_by INTEGER REFERENCES users(id),
  storage_provider TEXT NOT NULL DEFAULT 'local',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  extracted_text TEXT
);

CREATE INDEX IF NOT EXISTS attachments_subject_idx ON attachments (subject_id);
CREATE INDEX IF NOT EXISTS attachments_material_idx ON attachments (material_id);

-- GIN index on attachments extracted_text (uses to_tsvector at index creation time)
-- Note: Creating an expression index like below is supported in Postgres 9.6+.
CREATE INDEX IF NOT EXISTS attachments_text_tsv_idx ON attachments USING GIN (to_tsvector('simple', coalesce(extracted_text, '')));

COMMIT;