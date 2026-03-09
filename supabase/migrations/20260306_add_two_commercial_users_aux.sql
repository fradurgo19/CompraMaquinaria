-- Migration: Add 2 commercial users (rol comerciales) - Maria Alejandra Rivas, Marisol Aristizabal
-- Created: 2026-03-06
-- Description: Crea usuarios aux.comercial1@partequipos.com y aux.comercial2@partequipos.com
-- con rol comerciales y contraseñas únicas (comercial028, comercial029). Mismo rol y permisos
-- que el resto de comerciales. No modifica lógica, permisos ni flujo de datos.

-- =====================================================
-- USUARIOS COMERCIALES (rol: comerciales)
-- =====================================================

-- 1. Maria Alejandra Rivas - aux.comercial1@partequipos.com (comercial028)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000044',
  'aux.comercial1@partequipos.com',
  crypt('comercial028', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'aux.comercial1@partequipos.com' OR id = '20000000-0000-0000-0000-000000000044');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000044',
  'Maria Alejandra Rivas',
  'aux.comercial1@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Maria Alejandra Rivas', email = 'aux.comercial1@partequipos.com', updated_at = NOW();

-- 2. Marisol Aristizabal - aux.comercial2@partequipos.com (comercial029)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000045',
  'aux.comercial2@partequipos.com',
  crypt('comercial029', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'aux.comercial2@partequipos.com' OR id = '20000000-0000-0000-0000-000000000045');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000045',
  'Marisol Aristizabal',
  'aux.comercial2@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Marisol Aristizabal', email = 'aux.comercial2@partequipos.com', updated_at = NOW();

-- =====================================================
-- REFERENCIA: Nuevos correos -> Contraseña
-- =====================================================
-- aux.comercial1@partequipos.com -> comercial028
-- aux.comercial2@partequipos.com -> comercial029
