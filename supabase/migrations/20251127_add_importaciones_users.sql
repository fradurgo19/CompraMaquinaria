-- Crear usuarios de importaciones en auth.users y users_profile
-- Nota: Las contraseñas deben ser cambiadas por el administrador

-- Usuario 1: GUILLERMO PERILLA MEJIA - JEFE DE COMERCIO EXTERIOR MAQUINARIA
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
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'comercioexteriormq@partequipos.com',
  crypt('Partequipos2024!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users_profile (id, full_name, role, email)
SELECT id, 'GUILLERMO PERILLA MEJIA', 'importaciones', 'comercioexteriormq@partequipos.com'
FROM auth.users WHERE email = 'comercioexteriormq@partequipos.com'
ON CONFLICT (id) DO NOTHING;

-- Usuario 2: DICK NASIR SALAZAR - ANALISTA COMERCIO EXTERIOR
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
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'comercioexterior9@partequipos.com',
  crypt('Partequipos2024!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users_profile (id, full_name, role, email)
SELECT id, 'DICK NASIR SALAZAR', 'importaciones', 'comercioexterior9@partequipos.com'
FROM auth.users WHERE email = 'comercioexterior9@partequipos.com'
ON CONFLICT (id) DO NOTHING;

-- Usuario 3: VANESSA CASTAÑO - ANALISTA COMERCIO EXTERIOR
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
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'comercioexterior2@partequipos.com',
  crypt('Partequipos2024!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users_profile (id, full_name, role, email)
SELECT id, 'VANESSA CASTAÑO', 'importaciones', 'comercioexterior2@partequipos.com'
FROM auth.users WHERE email = 'comercioexterior2@partequipos.com'
ON CONFLICT (id) DO NOTHING;

