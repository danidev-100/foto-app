-- 008_fix_course_names.sql
-- Fix course names to match frontend COURSE_STRUCTURE format.
-- Frontend expects names like "Primaria - 1° Primero" and "Secundaria - 1° Primero".
-- Existing courses (1er-7mo Año) are mapped to Primaria grades 1-7.
-- Missing courses (Jardín, Secundaria 1-5) are added.

BEGIN;

-- Step 1: Map existing courses to new names (Primaria grades 1-7)
-- We use a CTE to assign row numbers and map them to the correct names
WITH numbered_courses AS (
  SELECT id, name,
         ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM courses
  WHERE name IN ('1er Año', '2do Año', '3er Año', '4to Año', '5to Año', '6to Año', '7mo Año')
),
name_mapping AS (
  VALUES
    (1, 'Primaria - 1° Primero'),
    (2, 'Primaria - 2° Segundo'),
    (3, 'Primaria - 3° Tercero'),
    (4, 'Primaria - 4° Cuarto'),
    (5, 'Primaria - 5° Quinto'),
    (6, 'Primaria - 6° Sexto'),
    (7, 'Primaria - 7° Séptimo')
)
UPDATE courses c
SET name = nm.column2, updated_at = NOW()
FROM numbered_courses nc
JOIN name_mapping nm ON nc.rn = nm.column1
WHERE c.id = nc.id;

-- Step 2: Add missing Primaria - Jardín course (only if not exists)
INSERT INTO courses (name, description, is_active, created_at, updated_at)
SELECT 'Primaria - Jardín', 'Jardín de Infantes', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = 'Primaria - Jardín');

-- Step 3: Add Secundaria courses (only if not exists)
INSERT INTO courses (name, description, is_active, created_at, updated_at)
SELECT name, descr, true, NOW(), NOW()
FROM (VALUES
  ('Secundaria - 1° Primero', 'Primer año secundaria'),
  ('Secundaria - 2° Segundo', 'Segundo año secundaria'),
  ('Secundaria - 3° Tercero', 'Tercer año secundaria'),
  ('Secundaria - 4° Cuarto', 'Cuarto año secundaria'),
  ('Secundaria - 5° Quinto', 'Quinto año secundaria')
) AS v(name, descr)
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE courses.name = v.name);

-- Step 4: Add divisions for new courses that don't have them yet
-- Primaria courses (A, B, C) - only for courses that exist but have no divisions
INSERT INTO divisions (course_id, name, is_active, created_at, updated_at)
SELECT c.id, d.name, true, NOW(), NOW()
FROM courses c
CROSS JOIN (VALUES ('A'), ('B'), ('C')) AS d(name)
WHERE c.name LIKE 'Primaria - %'
  AND NOT EXISTS (SELECT 1 FROM divisions WHERE course_id = c.id AND name = d.name);

-- Secundaria 1° and 2° (A, B, C, D, E)
INSERT INTO divisions (course_id, name, is_active, created_at, updated_at)
SELECT c.id, d.name, true, NOW(), NOW()
FROM courses c
CROSS JOIN (VALUES ('A'), ('B'), ('C'), ('D'), ('E')) AS d(name)
WHERE c.name IN ('Secundaria - 1° Primero', 'Secundaria - 2° Segundo')
  AND NOT EXISTS (SELECT 1 FROM divisions WHERE course_id = c.id AND name = d.name);

-- Secundaria 3°, 4°, 5° (A, B, N, H)
INSERT INTO divisions (course_id, name, is_active, created_at, updated_at)
SELECT c.id, d.name, true, NOW(), NOW()
FROM courses c
CROSS JOIN (VALUES ('A'), ('B'), ('N'), ('H')) AS d(name)
WHERE c.name IN ('Secundaria - 3° Tercero', 'Secundaria - 4° Cuarto', 'Secundaria - 5° Quinto')
  AND NOT EXISTS (SELECT 1 FROM divisions WHERE course_id = c.id AND name = d.name);

COMMIT;
