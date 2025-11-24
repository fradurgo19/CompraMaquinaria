-- Migration: Add 'pagos' user for Supabase
-- Created: 2025-11-22
-- Description: Create pagos user in Supabase (runs after 20251122_add_pagos_role.sql)

-- Crear usuario en auth.users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) 
VALUES (
  '10000000-0000-0000-0000-000000000011',
  'pagos@partequipos.com',
  crypt('pagos123', gen_salt('bf')),
  NOW(),
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
) ON CONFLICT (id) DO UPDATE SET
  role = 'pagos',
  updated_at = NOW();

