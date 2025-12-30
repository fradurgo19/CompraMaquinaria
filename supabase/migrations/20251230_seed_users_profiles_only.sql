-- Migration: Seed User Profiles Only (Users must be created in Authentication first)
-- Created: 2025-12-30
-- Description: Crea solo los perfiles en users_profile
-- IMPORTANTE: 
--   1. Primero crear los usuarios en Supabase Dashboard > Authentication > Users
--   2. Copiar los IDs de cada usuario
--   3. Reemplazar los IDs en este script con los IDs reales
--   4. Ejecutar este script desde SQL Editor

-- =====================================================
-- INSTRUCCIONES:
-- =====================================================
-- 1. Ve a Supabase Dashboard > Authentication > Users
-- 2. Crea los siguientes usuarios manualmente:
--    - comercial@partequipos.com
--    - comercial2@partequipos.com
--    - comercial3@partequipos.com
--    - jefecomercial@partequipos.com
--    - importaciones@partequipos.com
--    - logistica@partequipos.com
--    - pagos@partequipos.com
-- 3. Copia el ID de cada usuario
-- 4. Reemplaza los UUIDs en este script con los IDs reales
-- 5. Ejecuta este script
-- =====================================================

-- =====================================================
-- USUARIOS COMERCIALES
-- =====================================================
-- Reemplaza 'REPLACE_WITH_REAL_ID' con el ID real del usuario

-- Usuario Comercial 1
INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'Usuario Comercial',
  'comercial@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'comercial@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'comerciales',
  full_name = 'Usuario Comercial',
  updated_at = NOW();

-- Usuario Comercial 2
INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'Usuario Comercial 2',
  'comercial2@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'comercial2@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'comerciales',
  full_name = 'Usuario Comercial 2',
  updated_at = NOW();

-- Usuario Comercial 3
INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'Usuario Comercial 3',
  'comercial3@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'comercial3@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'comerciales',
  full_name = 'Usuario Comercial 3',
  updated_at = NOW();

-- Jefe Comercial
INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'Jefe Comercial',
  'jefecomercial@partequipos.com',
  'jefe_comercial',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'jefecomercial@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'jefe_comercial',
  full_name = 'Jefe Comercial',
  updated_at = NOW();

-- =====================================================
-- USUARIO DE IMPORTACIONES
-- =====================================================

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'Usuario Importaciones',
  'importaciones@partequipos.com',
  'importaciones',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'importaciones@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'importaciones',
  full_name = 'Usuario Importaciones',
  updated_at = NOW();

-- =====================================================
-- USUARIO DE LOGÍSTICA
-- =====================================================

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'Usuario Logística',
  'logistica@partequipos.com',
  'logistica',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'logistica@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'logistica',
  full_name = 'Usuario Logística',
  updated_at = NOW();

-- =====================================================
-- USUARIO DE PAGOS
-- =====================================================

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
SELECT 
  id,
  'Usuario Pagos',
  'pagos@partequipos.com',
  'pagos',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'pagos@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'pagos',
  full_name = 'Usuario Pagos',
  updated_at = NOW();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmed,
  p.full_name,
  p.role,
  p.id
FROM auth.users u
LEFT JOIN public.users_profile p ON u.id = p.id
WHERE u.email IN (
  'comercial@partequipos.com',
  'comercial2@partequipos.com',
  'comercial3@partequipos.com',
  'jefecomercial@partequipos.com',
  'importaciones@partequipos.com',
  'logistica@partequipos.com',
  'pagos@partequipos.com'
)
ORDER BY p.role, u.email;

