-- admin.sql
-- Thêm cột role cho users và tạo bảng uploads & comments nếu chưa có
-- Chạy file này trên cơ sở dữ liệu PostgreSQL của bạn.

-- 1) Thêm cột role cho users (nếu chưa có)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';

-- 2) Tạo bảng uploads để lưu metadata file đã upload
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,          -- tên file lưu trên đĩa
  original_name TEXT NOT NULL,     -- tên file gốc do user upload
  mimetype TEXT,
  size INTEGER,
  path TEXT NOT NULL,              -- đường dẫn tương đối (ví dụ: /uploads/xxx)
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3) Tạo bảng comments (nếu bạn đã có comments table thì bỏ qua hoặc gộp lại)
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);