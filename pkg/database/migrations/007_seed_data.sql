-- Seed data for development
-- Course names match frontend COURSE_STRUCTURE format: "{Level} - {Grade}"

-- Courses - Primaria (Jardín + 1° to 7°)
INSERT INTO courses (id, name, description, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Primaria - Jardín', 'Jardín de Infantes', true, NOW(), NOW()),
  (gen_random_uuid(), 'Primaria - 1° Primero', 'Primer año primaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Primaria - 2° Segundo', 'Segundo año primaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Primaria - 3° Tercero', 'Tercer año primaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Primaria - 4° Cuarto', 'Cuarto año primaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Primaria - 5° Quinto', 'Quinto año primaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Primaria - 6° Sexto', 'Sexto año primaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Primaria - 7° Séptimo', 'Séptimo año primaria', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Courses - Secundaria (1° to 5°)
INSERT INTO courses (id, name, description, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Secundaria - 1° Primero', 'Primer año secundaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Secundaria - 2° Segundo', 'Segundo año secundaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Secundaria - 3° Tercero', 'Tercer año secundaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Secundaria - 4° Cuarto', 'Cuarto año secundaria', true, NOW(), NOW()),
  (gen_random_uuid(), 'Secundaria - 5° Quinto', 'Quinto año secundaria', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Divisions for Primaria courses (A, B, C)
INSERT INTO divisions (id, course_id, name, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), c.id, d.name, true, NOW(), NOW()
  FROM courses c
  CROSS JOIN (VALUES ('A'), ('B'), ('C')) AS d(name)
  WHERE c.name LIKE 'Primaria - %'
ON CONFLICT DO NOTHING;

-- Divisions for Secundaria 1° and 2° (A, B, C, D, E)
INSERT INTO divisions (id, course_id, name, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), c.id, d.name, true, NOW(), NOW()
  FROM courses c
  CROSS JOIN (VALUES ('A'), ('B'), ('C'), ('D'), ('E')) AS d(name)
  WHERE c.name IN ('Secundaria - 1° Primero', 'Secundaria - 2° Segundo')
ON CONFLICT DO NOTHING;

-- Divisions for Secundaria 3°, 4°, 5° (A, B, N, H)
INSERT INTO divisions (id, course_id, name, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), c.id, d.name, true, NOW(), NOW()
  FROM courses c
  CROSS JOIN (VALUES ('A'), ('B'), ('N'), ('H')) AS d(name)
  WHERE c.name IN ('Secundaria - 3° Tercero', 'Secundaria - 4° Cuarto', 'Secundaria - 5° Quinto')
ON CONFLICT DO NOTHING;

-- Admin user (password: admin123)
INSERT INTO students (id, name, email, password_hash, course_id, is_admin, is_active, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    'Administrador',
    'admin@fotoapp.com',
    '$2a$12$6K8a290HBGEbSK6MVA1qWeTHsxym8.SJ1eEZVyEBNrrak30CeHECa',
    c.id,
    true,
    true,
    NOW(),
    NOW()
  FROM courses c
  WHERE c.name = 'Primaria - 1° Primero'
  LIMIT 1
ON CONFLICT DO NOTHING;

-- Sample booklets
INSERT INTO booklets (id, course_id, division_id, title, description, current_price, stock, image_url, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), c.id, d.id, 'Matemáticas - Unidad 1', 'Cuadernillo de Matemáticas', 150000, 50, '', true, NOW(), NOW()
  FROM courses c
  CROSS JOIN LATERAL (SELECT id FROM divisions WHERE course_id = c.id AND name = 'A' LIMIT 1) d
  WHERE c.name = 'Primaria - 1° Primero'
ON CONFLICT DO NOTHING;

INSERT INTO booklets (id, course_id, division_id, title, description, current_price, stock, image_url, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), c.id, d.id, 'Lengua - Unidad 1', 'Cuadernillo de Lengua', 120000, 50, '', true, NOW(), NOW()
  FROM courses c
  CROSS JOIN LATERAL (SELECT id FROM divisions WHERE course_id = c.id AND name = 'A' LIMIT 1) d
  WHERE c.name = 'Primaria - 1° Primero'
ON CONFLICT DO NOTHING;

INSERT INTO booklets (id, course_id, division_id, title, description, current_price, stock, image_url, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), c.id, d.id, 'Ciencias Naturales - Unidad 1', 'Cuadernillo de Ciencias', 130000, 50, '', true, NOW(), NOW()
  FROM courses c
  CROSS JOIN LATERAL (SELECT id FROM divisions WHERE course_id = c.id AND name = 'A' LIMIT 1) d
  WHERE c.name = 'Primaria - 2° Segundo'
ON CONFLICT DO NOTHING;
