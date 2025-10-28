-- Crear usuario de logística
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at) 
VALUES (
  '10000000-0000-0000-0000-000000000004',
  'logistica@partequipos.com',
  crypt('logistica123', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000004',
  'Usuario Logística',
  'logistica@partequipos.com',
  'logistica',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

