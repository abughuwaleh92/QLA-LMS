-- Ensure lessons has the columns we need and the unique constraints used by upserts
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS html_path TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS description TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS lessons_slug_unique ON lessons(slug);
CREATE UNIQUE INDEX IF NOT EXISTS lessons_grade_unit_order_unique ON lessons(grade,unit,lesson_order);
