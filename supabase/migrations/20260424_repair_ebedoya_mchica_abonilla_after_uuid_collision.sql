-- Repair: usuarios ebedoya / mchica / abonilla tras colisión de UUIDs con 20260306 (044–045 = aux comercial).
-- Si ya ejecutaste una versión anterior de 20260423 que usaba 044–046, el perfil pudo quedar con correo nuevo
-- pero auth.users seguía con aux@ → el backend (/api/auth/login) no encontraba fila por email.
-- Este script: restaura perfiles aux en 044/045 si el correo en auth no coincide con users_profile, y crea
-- los tres usuarios definitivos en 047–049. Idempotente por email / id.

-- =====================================================
-- 1. Restaurar consistencia aux.comercial1 / aux.comercial2 (ids 044 y 045)
-- =====================================================
UPDATE public.users_profile p
SET
  full_name = v.full_name,
  email = v.email,
  role = 'comerciales',
  updated_at = NOW()
FROM (VALUES
  ('20000000-0000-0000-0000-000000000044'::uuid, 'Maria Alejandra Rivas', 'aux.comercial1@partequipos.com'),
  ('20000000-0000-0000-0000-000000000045'::uuid, 'Marisol Aristizabal', 'aux.comercial2@partequipos.com')
) AS v(id, full_name, email)
WHERE p.id = v.id
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p.id AND lower(trim(u.email)) = lower(trim(v.email))
  );

-- =====================================================
-- 2. Crear usuarios correctos (mismos datos que 20260423 corregido)
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
