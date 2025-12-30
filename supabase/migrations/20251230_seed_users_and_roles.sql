-- Migration: Seed Users and Roles
-- Created: 2025-12-30
-- Description: Crea todos los usuarios del sistema en Supabase
-- IMPORTANTE: Ejecutar desde SQL Editor de Supabase
-- NOTA: Si los usuarios ya existen en Authentication, solo se crearán los perfiles

-- =====================================================
-- USUARIOS PRINCIPALES
-- =====================================================

-- Sebastián (Subastas)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '00000000-0000-0000-0000-000000000001',
  'sebastian@partequipos.com',
  crypt('sebastian123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sebastian@partequipos.com' OR id = '00000000-0000-0000-0000-000000000001');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sebastián García',
  'sebastian@partequipos.com',
  'sebastian',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'sebastian',
  updated_at = NOW();

-- Eliana (Compras)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '00000000-0000-0000-0000-000000000002',
  'eliana@partequipos.com',
  crypt('eliana123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'eliana@partequipos.com' OR id = '00000000-0000-0000-0000-000000000002');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Eliana Rodríguez',
  'eliana@partequipos.com',
  'eliana',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'eliana',
  updated_at = NOW();

-- Gerencia
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '00000000-0000-0000-0000-000000000003',
  'gerencia@partequipos.com',
  crypt('gerencia123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gerencia@partequipos.com' OR id = '00000000-0000-0000-0000-000000000003');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Director General',
  'gerencia@partequipos.com',
  'gerencia',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'gerencia',
  updated_at = NOW();

-- Admin
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '10000000-0000-0000-0000-000000000010',
  'admin@partequipos.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@partequipos.com' OR id = '10000000-0000-0000-0000-000000000010');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000010',
  'Administrador',
  'admin@partequipos.com',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  updated_at = NOW();

-- =====================================================
-- USUARIOS COMERCIALES
-- =====================================================

-- Usuario Comercial 1
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '20000000-0000-0000-0000-000000000001',
  'comercial@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'comercial@partequipos.com' OR id = '20000000-0000-0000-0000-000000000001');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'Usuario Comercial',
  'comercial@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'comerciales',
  updated_at = NOW();

-- Usuario Comercial 2
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '20000000-0000-0000-0000-000000000003',
  'comercial2@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'comercial2@partequipos.com' OR id = '20000000-0000-0000-0000-000000000003');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000003',
  'Usuario Comercial 2',
  'comercial2@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'comerciales',
  updated_at = NOW();

-- Usuario Comercial 3
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '20000000-0000-0000-0000-000000000004',
  'comercial3@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'comercial3@partequipos.com' OR id = '20000000-0000-0000-0000-000000000004');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000004',
  'Usuario Comercial 3',
  'comercial3@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'comerciales',
  updated_at = NOW();

-- Jefe Comercial
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '20000000-0000-0000-0000-000000000002',
  'jefecomercial@partequipos.com',
  crypt('jefecomercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'jefecomercial@partequipos.com' OR id = '20000000-0000-0000-0000-000000000002');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000002',
  'Lina Gonzalez',
  'jefecomercial@partequipos.com',
  'jefe_comercial',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'jefe_comercial',
  full_name = 'Lina Gonzalez',
  updated_at = NOW();

-- =====================================================
-- USUARIOS DE IMPORTACIONES
-- =====================================================

-- Usuario genérico de importaciones
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '10000000-0000-0000-0000-000000000003',
  'importaciones@partequipos.com',
  crypt('import123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'importaciones@partequipos.com' OR id = '10000000-0000-0000-0000-000000000003');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000003',
  'Usuario Importaciones',
  'importaciones@partequipos.com',
  'importaciones',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'importaciones',
  updated_at = NOW();

-- GUILLERMO PERILLA MEJIA - JEFE DE COMERCIO EXTERIOR MAQUINARIA
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  gen_random_uuid(),
  'comercioexteriormq@partequipos.com',
  crypt('Partequipos2024!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'comercioexteriormq@partequipos.com');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'GUILLERMO PERILLA MEJIA',
  'comercioexteriormq@partequipos.com',
  'importaciones',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'comercioexteriormq@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'importaciones',
  full_name = 'GUILLERMO PERILLA MEJIA',
  updated_at = NOW();

-- DICK NASIR SALAZAR - ANALISTA COMERCIO EXTERIOR
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  gen_random_uuid(),
  'comercioexterior9@partequipos.com',
  crypt('Partequipos2024!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'comercioexterior9@partequipos.com');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'DICK NASIR SALAZAR',
  'comercioexterior9@partequipos.com',
  'importaciones',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'comercioexterior9@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'importaciones',
  full_name = 'DICK NASIR SALAZAR',
  updated_at = NOW();

-- VANESSA CASTAÑO - ANALISTA COMERCIO EXTERIOR
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  gen_random_uuid(),
  'comercioexterior2@partequipos.com',
  crypt('Partequipos2024!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'comercioexterior2@partequipos.com');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'VANESSA CASTAÑO',
  'comercioexterior2@partequipos.com',
  'importaciones',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'comercioexterior2@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'importaciones',
  full_name = 'VANESSA CASTAÑO',
  updated_at = NOW();

-- =====================================================
-- USUARIO DE LOGÍSTICA
-- =====================================================

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '10000000-0000-0000-0000-000000000004',
  'logistica@partequipos.com',
  crypt('logistica123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'logistica@partequipos.com' OR id = '10000000-0000-0000-0000-000000000004');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000004',
  'Usuario Logística',
  'logistica@partequipos.com',
  'logistica',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'logistica',
  updated_at = NOW();

-- =====================================================
-- USUARIO DE SERVICIO
-- =====================================================

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '10000000-0000-0000-0000-000000000005',
  'servicio@partequipos.com',
  crypt('servicio123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'servicio@partequipos.com' OR id = '10000000-0000-0000-0000-000000000005');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000005',
  'Usuario Servicio',
  'servicio@partequipos.com',
  'servicio',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'servicio',
  updated_at = NOW();

-- =====================================================
-- USUARIO DE PAGOS
-- =====================================================

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
SELECT 
  '10000000-0000-0000-0000-000000000011',
  'pagos@partequipos.com',
  crypt('pagos123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pagos@partequipos.com' OR id = '10000000-0000-0000-0000-000000000011');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000011',
  'Usuario Pagos',
  'pagos@partequipos.com',
  'pagos',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'pagos',
  updated_at = NOW();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar usuarios creados
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmed,
  p.full_name,
  p.role
FROM auth.users u
LEFT JOIN public.users_profile p ON u.id = p.id
WHERE u.email IN (
  'sebastian@partequipos.com',
  'eliana@partequipos.com',
  'gerencia@partequipos.com',
  'admin@partequipos.com',
  'comercial@partequipos.com',
  'comercial2@partequipos.com',
  'comercial3@partequipos.com',
  'jefecomercial@partequipos.com',
  'importaciones@partequipos.com',
  'comercioexteriormq@partequipos.com',
  'comercioexterior9@partequipos.com',
  'comercioexterior2@partequipos.com',
  'logistica@partequipos.com',
  'servicio@partequipos.com',
  'pagos@partequipos.com'
)
ORDER BY p.role, u.email;

