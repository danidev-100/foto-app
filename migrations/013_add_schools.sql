-- Create schools and link all existing courses to both schools
INSERT INTO schools (id, name, short_name, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Colegio Don Bosco', 'Don Bosco', true, NOW(), NOW()),
  (gen_random_uuid(), 'Instituto Rodeo del Medio', 'Rodeo del Medio', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Link all active courses to both schools
INSERT INTO school_courses (school_id, course_id)
  SELECT s.id, c.id
  FROM schools s
  CROSS JOIN courses c
  WHERE c.is_active = true
ON CONFLICT DO NOTHING;
