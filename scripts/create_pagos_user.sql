-- Script para crear usuario de pagos
-- Ejecutar: psql -U postgres -d maquinaria_usada -f scripts/create_pagos_user.sql

-- Crear usuario en auth.users
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at) 
VALUES (
  '10000000-0000-0000-0000-000000000011',
  'pagos@partequipos.com',
  crypt('pagos123', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Crear perfil en users_profile
INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000011',
  'Usuario Pagos',
  'pagos@partequipos.com',
  'pagos',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verificar creación
SELECT email FROM auth.users WHERE email = 'pagos@partequipos.com';
SELECT id, full_name, email, role FROM users_profile WHERE id = '10000000-0000-0000-0000-000000000011';

