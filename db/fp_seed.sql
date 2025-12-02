-- Seed data cho "fp"
INSERT INTO classes (name) VALUES
('Lá»›p 6'), ('Lá»›p 7'), ('Lá»›p 8'), ('Lá»›p 9'), ('Lá»›p 10'), ('Lá»›p 11'), ('Lá»›p 12')
ON CONFLICT (name) DO NOTHING;

-- Lá»›p 6
INSERT INTO subjects (class_id, name, slug)
SELECT c.id, s.name, lower(regexp_replace(s.name, '\s+', '-', 'g'))
FROM classes c, (VALUES ('ToÃ¡n'),('Ngá»¯ vÄƒn'),('Tiáº¿ng Anh'),('Khoa há»c tá»± nhiÃªn'),('Lá»‹ch sá»­'),('Äá»‹a lÃ½')) AS s(name)
WHERE c.name='Lá»›p 6'
ON CONFLICT (class_id, name) DO NOTHING;

-- Lá»›p 7
INSERT INTO subjects (class_id, name, slug)
SELECT c.id, s.name, lower(regexp_replace(s.name, '\s+', '-', 'g'))
FROM classes c, (VALUES ('ToÃ¡n'),('Ngá»¯ vÄƒn'),('Tiáº¿ng Anh'),('Váº­t lÃ½ cÆ¡ báº£n'),('Sinh há»c'),('CÃ´ng nghá»‡')) AS s(name)
WHERE c.name='Lá»›p 7'
ON CONFLICT (class_id, name) DO NOTHING;

-- Lá»›p 8
INSERT INTO subjects (class_id, name, slug)
SELECT c.id, s.name, lower(regexp_replace(s.name, '\s+', '-', 'g'))
FROM classes c, (VALUES ('ToÃ¡n'),('Ngá»¯ vÄƒn'),('Tiáº¿ng Anh'),('Váº­t lÃ½'),('HÃ³a há»c'),('Lá»‹ch sá»­')) AS s(name)
WHERE c.name='Lá»›p 8'
ON CONFLICT (class_id, name) DO NOTHING;

-- Lá»›p 9
INSERT INTO subjects (class_id, name, slug)
SELECT c.id, s.name, lower(regexp_replace(s.name, '\s+', '-', 'g'))
FROM classes c, (VALUES ('ToÃ¡n'),('Ngá»¯ vÄƒn'),('Tiáº¿ng Anh'),('Váº­t lÃ½'),('HÃ³a há»c'),('Sinh há»c')) AS s(name)
WHERE c.name='Lá»›p 9'
ON CONFLICT (class_id, name) DO NOTHING;

-- Lá»›p 10..12
INSERT INTO subjects (class_id, name, slug)
SELECT c.id, s.name, lower(regexp_replace(s.name, '\s+', '-', 'g'))
FROM classes c, (VALUES ('ToÃ¡n'),('Ngá»¯ vÄƒn'),('Tiáº¿ng Anh'),('Váº­t lÃ½'),('HÃ³a há»c'),('Sinh há»c')) AS s(name)
WHERE c.name IN ('Lá»›p 10','Lá»›p 11','Lá»›p 12')
ON CONFLICT (class_id, name) DO NOTHING;

-- materials demo cho Lá»›p 6 - ToÃ¡n
INSERT INTO materials (subject_id, title, content, url)
SELECT s.id, 'BÃ i máº«u: PhÃ©p cá»™ng', 'VÃ­ dá»¥ ná»™i dung: cÃ¡ch giáº£i phÃ©p cá»™ng cÆ¡ báº£n', NULL
FROM subjects s JOIN classes c ON s.class_id = c.id
WHERE c.name='Lá»›p 6' AND s.name='ToÃ¡n'
LIMIT 1
ON CONFLICT DO NOTHING;