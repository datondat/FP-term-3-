-- admin.sql
-- ThÃªm cá»™t role cho users vÃ  táº¡o báº£ng uploads & comments náº¿u chÆ°a cÃ³
-- Cháº¡y file nÃ y trÃªn cÆ¡ sá»Ÿ dá»¯ liá»‡u PostgreSQL cá»§a báº¡n.

-- 1) ThÃªm cá»™t role cho users (náº¿u chÆ°a cÃ³)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';

-- 2) Táº¡o báº£ng uploads Ä‘á»ƒ lÆ°u metadata file Ä‘Ã£ upload
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,          -- tÃªn file lÆ°u trÃªn Ä‘Ä©a
  original_name TEXT NOT NULL,     -- tÃªn file gá»‘c do user upload
  mimetype TEXT,
  size INTEGER,
  path TEXT NOT NULL,              -- Ä‘Æ°á»ng dáº«n tÆ°Æ¡ng Ä‘á»‘i (vÃ­ dá»¥: /uploads/xxx)
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3) Táº¡o báº£ng comments (náº¿u báº¡n Ä‘Ã£ cÃ³ comments table thÃ¬ bá» qua hoáº·c gá»™p láº¡i)
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
