-- ========================================
-- SCRIPT DE CONFIGURACIÓN INICIAL
-- Sistema de Gestión de Compra de Maquinaria Usada
-- PostgreSQL 17
-- ========================================

-- 1. CREAR BASE DE DATOS (ejecutar como superusuario)
-- CREATE DATABASE maquinaria_usada;
-- \c maquinaria_usada

-- 2. CREAR EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Para encriptación de passwords

-- 3. CREAR SCHEMAS
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;

-- 4. CREAR TABLA DE USUARIOS EN AUTH
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. FUNCIÓN PARA SIMULAR auth.uid() (compatible con Supabase)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- 6. CREAR USUARIOS DE PRUEBA
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    'sebastian@partequipos.com',
    crypt('sebastian123', gen_salt('bf')),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'eliana@partequipos.com',
    crypt('eliana123', gen_salt('bf')),
    now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'gerencia@partequipos.com',
    crypt('gerencia123', gen_salt('bf')),
    now()
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'admin@partequipos.com',
    crypt('admin123', gen_salt('bf')),
    now()
  )
ON CONFLICT (email) DO NOTHING;

-- 7. MENSAJE DE ÉXITO
DO $$
BEGIN
  RAISE NOTICE '✓ Base de datos configurada exitosamente';
  RAISE NOTICE '✓ Ejecutar ahora las migraciones en orden:';
  RAISE NOTICE '  1. supabase/migrations/20251015221509_create_initial_schema.sql';
  RAISE NOTICE '  2. supabase/migrations/20251015222311_seed_initial_data.sql';
  RAISE NOTICE '  3. supabase/migrations/20251015230000_update_schema_complete.sql';
  RAISE NOTICE '';
  RAISE NOTICE 'Usuarios de prueba creados:';
  RAISE NOTICE '  - sebastian@partequipos.com / sebastian123';
  RAISE NOTICE '  - eliana@partequipos.com / eliana123';
  RAISE NOTICE '  - gerencia@partequipos.com / gerencia123';
  RAISE NOTICE '  - admin@partequipos.com / admin123';
END $$;

