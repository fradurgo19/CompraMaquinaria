-- Script de verificación antes de aplicar la migración
-- Ejecutar esto primero en Supabase SQL Editor para verificar el estado actual

-- 1. Verificar políticas existentes en users_profile
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users_profile'
ORDER BY policyname;

-- 2. Verificar si las funciones ya existen
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('get_all_users_for_notification_rules', 'is_admin_user');

-- 3. Verificar estructura de users_profile
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users_profile' AND table_schema = 'public'
ORDER BY ordinal_position;
