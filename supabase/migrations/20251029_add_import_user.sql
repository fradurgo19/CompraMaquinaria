-- Agregar usuario de importaciones en auth.users
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at) 
VALUES (
  '10000000-0000-0000-0000-000000000003',
  'importaciones@partequipos.com',
  crypt('import123', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Crear perfil en users_profile
INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000003',
  'Usuario Importaciones',
  'importaciones@partequipos.com',
  'importaciones',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

