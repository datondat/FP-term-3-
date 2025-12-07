-- db/fix_mojibake_subjects.sql (cleaned: no RAISE/TABLE outside PL/pgSQL)
-- Single-file: preview + safe apply for mojibake in subjects.name / subjects.title
-- See repository path in header (overwrite existing file with this content then run).

SET client_encoding = 'UTF8';

-- helper: attempts conversion src->dst, returns NULL on failure
CREATE OR REPLACE FUNCTION public.safe_recode(in_text text, src_encoding text, dst_encoding text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  out_text text;
BEGIN
  IF in_text IS NULL THEN RETURN NULL; END IF;
  BEGIN
    out_text := convert_from(convert_to(in_text, src_encoding), dst_encoding);
    RETURN out_text;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Build preview candidates: try WIN1252 and LATIN1
DROP TABLE IF EXISTS tmp_mojibake_candidates;
CREATE TEMP TABLE tmp_mojibake_candidates AS
SELECT
  id,
  class_id,
  name AS current_name,
  title AS current_title,
  safe_recode(name,'WIN1252','UTF8') AS win1252_fix_name,
  safe_recode(name,'LATIN1','UTF8')   AS latin1_fix_name,
  safe_recode(title,'WIN1252','UTF8') AS win1252_fix_title,
  safe_recode(title,'LATIN1','UTF8')   AS latin1_fix_title
FROM subjects;

-- Show preview summary and rows (SELECT used to avoid RAISE/TABLE syntax issues)
SELECT '=== Mojibake preview rows: ' || count(*) || ' ===' AS info
FROM tmp_mojibake_candidates
WHERE (win1252_fix_name IS NOT NULL AND win1252_fix_name <> current_name)
   OR (latin1_fix_name   IS NOT NULL AND latin1_fix_name   <> current_name)
   OR (win1252_fix_title IS NOT NULL AND win1252_fix_title <> current_title)
   OR (latin1_fix_title   IS NOT NULL AND latin1_fix_title   <> current_title);

SELECT id, class_id, current_name, current_title,
       win1252_fix_name, latin1_fix_name, win1252_fix_title, latin1_fix_title
FROM tmp_mojibake_candidates
WHERE (win1252_fix_name IS NOT NULL AND win1252_fix_name <> current_name)
   OR (latin1_fix_name   IS NOT NULL AND latin1_fix_name   <> current_name)
   OR (win1252_fix_title IS NOT NULL AND win1252_fix_title <> current_title)
   OR (latin1_fix_title   IS NOT NULL AND latin1_fix_title   <> current_title)
ORDER BY id DESC
LIMIT 500;

-- =====================
-- APPLY CHANGES (safe)
-- =====================
-- If you want PREVIEW only, comment out the DO block below before running.
DO $$
DECLARE
  r RECORD;
  chosen_name text;
  chosen_title text;
  existing_id integer;
BEGIN
  FOR r IN
    SELECT * FROM tmp_mojibake_candidates
    ORDER BY id
  LOOP
    chosen_name := NULL;
    IF r.win1252_fix_name IS NOT NULL AND r.win1252_fix_name <> r.current_name THEN
      chosen_name := r.win1252_fix_name;
    ELSIF r.latin1_fix_name IS NOT NULL AND r.latin1_fix_name <> r.current_name THEN
      chosen_name := r.latin1_fix_name;
    END IF;

    chosen_title := NULL;
    IF r.win1252_fix_title IS NOT NULL AND r.win1252_fix_title <> r.current_title THEN
      chosen_title := r.win1252_fix_title;
    ELSIF r.latin1_fix_title IS NOT NULL AND r.latin1_fix_title <> r.current_title THEN
      chosen_title := r.latin1_fix_title;
    END IF;

    IF chosen_name IS NULL AND chosen_title IS NULL THEN
      CONTINUE;
    END IF;

    IF chosen_name IS NOT NULL THEN
      SELECT id INTO existing_id FROM subjects WHERE class_id = r.class_id AND name = chosen_name LIMIT 1;
    ELSE
      existing_id := NULL;
    END IF;

    IF existing_id IS NOT NULL THEN
      UPDATE class_subjects SET subject_id = existing_id WHERE subject_id = r.id;
      DELETE FROM subjects WHERE id = r.id;
      -- record info via NOTICE inside PL/pgSQL (safe)
      RAISE NOTICE 'Merged subject id % => existing id % for class_id % (name="%")', r.id, existing_id, r.class_id, chosen_name;
      CONTINUE;
    ELSE
      IF chosen_name IS NOT NULL THEN
        UPDATE subjects SET name = chosen_name WHERE id = r.id;
        RAISE NOTICE 'Updated subjects.id % name => "%" ', r.id, chosen_name;
      END IF;
      IF chosen_title IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM subjects WHERE id = r.id) THEN
          UPDATE subjects SET title = chosen_title WHERE id = r.id;
          RAISE NOTICE 'Updated subjects.id % title => "%"', r.id, chosen_title;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Final verification output (shows recent subjects)
SELECT '=== After apply: recent subjects ===' AS info;
SELECT id, class_id, name, title FROM subjects ORDER BY id DESC LIMIT 200;