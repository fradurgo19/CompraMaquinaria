-- Migration: Eliana Victoria Bedoya (jefe_comercial), Mariluz Chica Alvarez y Angie Daniela Bonilla (comerciales)
-- Created: 2026-04-23
-- Updated: 2026-04-24 — UUIDs 047–049 (044–045 ya usados en 20260306_add_two_commercial_users_aux.sql; usar esos ids
--   omitía INSERT en auth pero pisaba users_profile → login por email fallaba).
-- Description: Inserta auth.users + public.users_profile; idempotente por email/id.
-- Roles en BD: Jefe Comercial -> jefe_comercial; Comercial -> comerciales.
-- Contraseñas iniciales: ver REFERENCIA al final.

-- =====================================================
-- 1. Eliana Victoria Bedoya — jefe_comercial
-- =====================================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000047',
  'ebedoya@partequipos.com',
  crypt('ebedoya123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ebedoya@partequipos.com' OR id = '20000000-0000-0000-0000-000000000047');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT u.id, 'Eliana Victoria Bedoya', 'ebedoya@partequipos.com', 'jefe_comercial', NOW(), NOW()
FROM auth.users u
WHERE u.id = '20000000-0000-0000-0000-000000000047'
ON CONFLICT (id) DO UPDATE SET
  role = 'jefe_comercial',
  full_name = 'Eliana Victoria Bedoya',
  email = 'ebedoya@partequipos.com',
  updated_at = NOW();

-- =====================================================
-- 2. Mariluz Chica Alvarez — comerciales
-- =====================================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000048',
  'mchica@partequipos.com',
  crypt('comercial030', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'mchica@partequipos.com' OR id = '20000000-0000-0000-0000-000000000048');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT u.id, 'Mariluz Chica Alvarez', 'mchica@partequipos.com', 'comerciales', NOW(), NOW()
FROM auth.users u
WHERE u.id = '20000000-0000-0000-0000-000000000048'
ON CONFLICT (id) DO UPDATE SET
  role = 'comerciales',
  full_name = 'Mariluz Chica Alvarez',
  email = 'mchica@partequipos.com',
  updated_at = NOW();

-- =====================================================
-- 3. Angie Daniela Bonilla — comerciales
-- =====================================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000049',
  'abonilla@partequipos.com',
  crypt('comercial031', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'abonilla@partequipos.com' OR id = '20000000-0000-0000-0000-000000000049');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT u.id, 'Angie Daniela Bonilla', 'abonilla@partequipos.com', 'comerciales', NOW(), NOW()
FROM auth.users u
WHERE u.id = '20000000-0000-0000-0000-000000000049'
ON CONFLICT (id) DO UPDATE SET
  role = 'comerciales',
  full_name = 'Angie Daniela Bonilla',
  email = 'abonilla@partequipos.com',
  updated_at = NOW();

-- =====================================================
-- REFERENCIA: correo -> contraseña inicial
-- =====================================================
-- ebedoya@partequipos.com  -> ebedoya123      (rol jefe_comercial)
-- mchica@partequipos.com   -> comercial030    (rol comerciales; 028/029 reservados para aux.comercial1/2)
-- abonilla@partequipos.com -> comercial031    (rol comerciales)
