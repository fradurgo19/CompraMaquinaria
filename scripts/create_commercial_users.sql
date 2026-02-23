-- Script para crear usuarios comerciales
-- Ejecutar: psql -U postgres -d maquinaria_usada -f scripts/create_commercial_users.sql
-- En Supabase: usar migración 20260223_add_commercial_users_batch.sql

-- Crear usuario comercial
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'comercial@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'Usuario Comercial',
  'comercial@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Crear comercial 2
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000003',
  'comercial2@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000003',
  'Usuario Comercial 2',
  'comercial2@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Crear comercial 3
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000004',
  'comercial3@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000004',
  'Usuario Comercial 3',
  'comercial3@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Lote adicional (24 usuarios, mismo rol comerciales, contraseña comercial123)
-- En Supabase aplicar: supabase/migrations/20260223_add_commercial_users_batch.sql
-- Lista: dramirez, jguerrero, gblanco, cecheverri, parabia, fgacha, lanchundia,
--        lcruz, yreina, jussa, cbogota, fmoreno, ebustos, dardila, erojas,
--        jsuarez, fcorrales, lcardona, fhurtado, erua, yochoa, lmartinez,
--        jflorez, rgarcia @partequipos.com
-- =====================================================

-- Crear jefe comercial
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at) 
VALUES (
  '20000000-0000-0000-0000-000000000002',
  'jefecomercial@partequipos.com',
  crypt('jefecomercial123', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000002',
  'Jefe Comercial',
  'jefecomercial@partequipos.com',
  'jefe_comercial',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verificar creación
SELECT email FROM auth.users WHERE email IN ('comercial@partequipos.com', 'comercial2@partequipos.com', 'comercial3@partequipos.com', 'jefecomercial@partequipos.com');
SELECT id, full_name, email, role FROM users_profile WHERE id IN ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004');
-- Comerciales adicionales (creados por migración 20260223): dramirez, jguerrero, gblanco, cecheverri, parabia, fgacha, lanchundia, lcruz, yreina, jussa, cbogota, fmoreno, ebustos, dardila, erojas, jsuarez, fcorrales, lcardona, fhurtado, erua, yochoa, lmartinez, jflorez, rgarcia @partequipos.com

