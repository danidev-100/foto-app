-- Add unique constraint to courses.name to prevent duplicate entries
-- This also makes ON CONFLICT DO NOTHING work correctly in seed data

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_name_unique ON courses (name);
