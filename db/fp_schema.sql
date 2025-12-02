-- Schema cho database "fp"
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);

CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tsv tsvector
);

CREATE OR REPLACE FUNCTION materials_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('simple',
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,'')
  );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsv_update ON materials;
CREATE TRIGGER tsv_update BEFORE INSERT OR UPDATE
  ON materials FOR EACH ROW EXECUTE PROCEDURE materials_tsv_trigger();

CREATE INDEX IF NOT EXISTS materials_tsv_idx ON materials USING GIN (tsv);
CREATE INDEX IF NOT EXISTS materials_title_trgm ON materials USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS subjects_class_idx ON subjects (class_id);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_subject_idx ON attachments (subject_id);
CREATE INDEX IF NOT EXISTS attachments_material_idx ON attachments (material_id);

ALTER TABLE attachments ADD COLUMN IF NOT EXISTS extracted_text text;
CREATE INDEX IF NOT EXISTS attachments_text_tsv_idx ON attachments USING GIN (to_tsvector('simple', coalesce(extracted_text, '')));