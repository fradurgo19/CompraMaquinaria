-- Migration: Verificar acceso a storage para diagnóstico
-- Created: 2025-01-14
-- Description: Script para verificar que las políticas de storage están correctamente configuradas

-- Verificar que las políticas existan
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%machine-files%'
ORDER BY policyname;

-- Verificar que la función get_user_role_from_storage existe
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'get_user_role_from_storage';

-- Verificar buckets existentes (esto requiere permisos de administrador)
-- SELECT name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE name = 'machine-files';

-- Si el bucket machine-files no tiene políticas o las políticas están bloqueando, ejecutar la migración 20260114_fix_machine_files_storage_policies.sql
