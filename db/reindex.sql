-- Rebuild tsv for materials using unaccent + simple config
UPDATE materials
SET tsv = to_tsvector('simple', unaccent(coalesce(title,'') || ' ' || coalesce(content,'')))
WHERE true;

-- Optionally rebuild attachments text index (if you stored extracted_text)
UPDATE attachments
SET extracted_text = coalesce(extracted_text, '')
WHERE true;