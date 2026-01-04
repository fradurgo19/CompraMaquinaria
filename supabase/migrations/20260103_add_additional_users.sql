-- Agregar usuarios adicionales con las mismas capacidades que los usuarios existentes
-- Estos usuarios tienen los mismos roles y permisos que sus contrapartes originales

-- =====================================================
-- USUARIO SEBASTIÁN ADICIONAL
-- =====================================================
-- Usuario con rol 'sebastian' (mismo que sebastian@partequipos.com)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000101',
  'authenticated',
  'authenticated',
  'sdonado@partequiposusa.com',
  crypt('sebastian123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sdonado@partequiposusa.com' OR id = '00000000-0000-0000-0000-000000000101');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  'Sebastián Donado',
  'sdonado@partequiposusa.com',
  'sebastian',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'sebastian',
  full_name = 'Sebastián Donado',
  email = 'sdonado@partequiposusa.com',
  updated_at = NOW();

-- =====================================================
-- USUARIO GERENCIA ADICIONAL
-- =====================================================
-- Usuario con rol 'gerencia' (mismo que gerencia@partequipos.com)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000102',
  'authenticated',
  'authenticated',
  'pcano@partequipos.com',
  crypt('gerencia123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pcano@partequipos.com' OR id = '00000000-0000-0000-0000-000000000102');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000102',
  'Pedro Cano',
  'pcano@partequipos.com',
  'gerencia',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'gerencia',
  full_name = 'Pedro Cano',
  email = 'pcano@partequipos.com',
  updated_at = NOW();

-- =====================================================
-- USUARIO JEFE COMERCIAL ADICIONAL
-- =====================================================
-- Usuario con rol 'jefe_comercial' (mismo que jefecomercial@partequipos.com)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000103',
  'authenticated',
  'authenticated',
  'lgonzalez@partequipos.com',
  crypt('jefecomercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'lgonzalez@partequipos.com' OR id = '00000000-0000-0000-0000-000000000103');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000103',
  'Lina Gonzalez',
  'lgonzalez@partequipos.com',
  'jefe_comercial',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'jefe_comercial',
  full_name = 'Lina Gonzalez',
  email = 'lgonzalez@partequipos.com',
  updated_at = NOW();

-- =====================================================
-- USUARIO PAGOS ADICIONAL
-- =====================================================
-- Usuario con rol 'pagos' (mismo que pagos@partequipos.com)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000104',
  'authenticated',
  'authenticated',
  'lflorez@partequipos.com',
  crypt('pagos123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'lflorez@partequipos.com' OR id = '00000000-0000-0000-0000-000000000104');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000104',
  'Luisa Florez',
  'lflorez@partequipos.com',
  'pagos',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'pagos',
  full_name = 'Luisa Florez',
  email = 'lflorez@partequipos.com',
  updated_at = NOW();

-- =====================================================
-- USUARIO ADMIN ADICIONAL
-- =====================================================
-- Usuario con rol 'admin' (mismo que admin@partequipos.com)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000105',
  'authenticated',
  'authenticated',
  'cvargas@partequipos.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'cvargas@partequipos.com' OR id = '00000000-0000-0000-0000-000000000105');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000105',
  'Cristina Vargas',
  'cvargas@partequipos.com',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = 'Cristina Vargas',
  email = 'cvargas@partequipos.com',
  updated_at = NOW();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que los usuarios se crearon correctamente
SELECT 
  u.email,
  p.full_name,
  p.role,
  u.email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users u
LEFT JOIN public.users_profile p ON u.id = p.id
WHERE u.email IN (
  'sdonado@partequiposusa.com',
  'pcano@partequipos.com',
  'lgonzalez@partequipos.com',
  'lflorez@partequipos.com',
  'cvargas@partequipos.com'
)
ORDER BY p.role, u.email;
