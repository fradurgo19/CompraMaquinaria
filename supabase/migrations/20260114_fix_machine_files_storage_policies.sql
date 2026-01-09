-- Migration: Fix storage policies for machine-files bucket to allow SERVICE_ROLE_KEY uploads
-- Created: 2025-01-14
-- Description: Ajusta las políticas de storage.objects para permitir subidas desde backend con SERVICE_ROLE_KEY
-- IMPORTANTE: Aunque SERVICE_ROLE_KEY debería bypassar RLS, estas políticas son necesarias para acceso directo

-- Eliminar políticas existentes del bucket machine-files
DROP POLICY IF EXISTS "Authenticated users can view machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete machine-files" ON storage.objects;

-- IMPORTANTE: SERVICE_ROLE_KEY bypassa RLS completamente, pero estas políticas son para acceso directo desde frontend si se necesita
-- Para el backend, el SERVICE_ROLE_KEY siempre puede operar independientemente de estas políticas

-- Política para SELECT (ver archivos) - Todos los usuarios autenticados
CREATE POLICY "Authenticated users can view machine-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'machine-files');

-- Política para INSERT (subir archivos) - Todos los usuarios autenticados pueden subir
-- NOTA: El backend usa SERVICE_ROLE_KEY que bypassa esta política, pero es necesaria para acceso directo
CREATE POLICY "Authenticated users can upload to machine-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'machine-files');

-- Política para UPDATE (actualizar archivos) - Todos los usuarios autenticados
CREATE POLICY "Users can update machine-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'machine-files')
WITH CHECK (bucket_id = 'machine-files');

-- Política para DELETE (eliminar archivos) - Solo admin o el que subió
CREATE POLICY "Users can delete machine-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'machine-files' 
  AND (
    public.get_user_role_from_storage() = 'admin'
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Comentarios
COMMENT ON POLICY "Authenticated users can upload to machine-files" ON storage.objects IS 
'Permite a usuarios autenticados subir archivos. El backend usa SERVICE_ROLE_KEY que bypassa RLS completamente.';

COMMENT ON POLICY "Authenticated users can view machine-files" ON storage.objects IS 
'Permite a usuarios autenticados ver archivos del bucket machine-files.';
