-- Script para crear usuario de logística
-- Ejecutar: psql -U postgres -d maquinaria_usada -f scripts/create_logistic_user.sql

-- Crear usuario en auth.users
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at) 
VALUES (
  '10000000-0000-0000-0000-000000000004',
  'logistica@partequipos.com',
  crypt('logistica123', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Crear perfil en users_profile
INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000004',
  'Usuario Logística',
  'logistica@partequipos.com',
  'logistica',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verificar creación
SELECT email FROM auth.users WHERE email = 'logistica@partequipos.com';
SELECT id, full_name, email, role FROM users_profile WHERE id = '10000000-0000-0000-0000-000000000004';

