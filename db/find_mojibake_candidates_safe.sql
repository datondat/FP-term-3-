-- db/find_mojibake_candidates_safe.sql
-- Tạo bảng tạm preview mọi hàng subjects với thử convert WIN1252/LATIN1 (sử dụng safe_recode)
SET client_encoding = 'UTF8';

-- đảm bảo hàm safe_recode tồn tại (nếu bạn đã tạo trước đó thì đây là no-op)
CREATE OR REPLACE FUNCTION public.safe_recode(in_text text, src_encoding text, dst_encoding text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  out_text text;
BEGIN
  BEGIN
    out_text := convert_from(convert_to(in_text, src_encoding), dst_encoding);
    RETURN out_text;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Tạo bảng tạm chứa thử convert (không dùng regex trên cột để tránh lỗi)
DROP TABLE IF EXISTS tmp_mojibake_candidates_safe;
CREATE TEMP TABLE tmp_mojibake_candidates_safe AS
SELECT
  id,
  class_id,
  name AS current_name,
  title AS current_title,
  safe_recode(name,'WIN1252','UTF8') AS win1252_fix,
  safe_recode(name,'LATIN1','UTF8')   AS latin1_fix,
  safe_recode(title,'WIN1252','UTF8') AS win1252_fix_title,
  safe_recode(title,'LATIN1','UTF8')   AS latin1_fix_title
FROM subjects;

-- Lọc chỉ những hàng mà ít nhất một conversion khác với giá trị hiện tại
-- (in ra để bạn so sánh và quyết định)
SELECT *
FROM tmp_mojibake_candidates_safe
WHERE (win1252_fix IS NOT NULL AND win1252_fix <> current_name)
   OR (latin1_fix   IS NOT NULL AND latin1_fix   <> current_name)
   OR (win1252_fix_title IS NOT NULL AND win1252_fix_title <> current_title)
   OR (latin1_fix_title   IS NOT NULL AND latin1_fix_title   <> current_title)
ORDER BY id DESC
LIMIT 500;