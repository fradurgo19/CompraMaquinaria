-- Migration: Ensure machine-files bucket exists and has correct policies
-- Created: 2025-01-14
-- Description: Asegura que el bucket machine-files existe y tiene políticas correctas para permitir subida desde backend con SERVICE_ROLE_KEY

-- IMPORTANTE: Este script debe ejecutarse desde el SQL Editor de Supabase con permisos de superusuario
-- El bucket debe existir antes de que las políticas funcionen

-- Verificar si el bucket existe (no se puede hacer directamente desde SQL, pero podemos verificar políticas)
-- Si el bucket no existe, crearlo manualmente desde el Dashboard de Supabase o usar la API

-- Eliminar políticas existentes si existen (para recrearlas)
DROP POLICY IF EXISTS "Authenticated users can view machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete machine-files" ON storage.objects;

-- Crear políticas que permitan a usuarios autenticados subir archivos
-- IMPORTANTE: El backend usa SERVICE_ROLE_KEY que bypassa RLS, pero estas políticas son para acceso directo desde el frontend si es necesario

-- Política para SELECT (ver archivos)
CREATE POLICY "Authenticated users can view machine-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'machine-files');

-- Política para INSERT (subir archivos) - Todos los usuarios autenticados pueden subir
-- El backend usa SERVICE_ROLE_KEY que bypassa estas políticas, pero las necesitamos para acceso directo desde frontend si aplica
CREATE POLICY "Authenticated users can upload to machine-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'machine-files');

-- Política para UPDATE (actualizar archivos)
CREATE POLICY "Users can update machine-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'machine-files');

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

-- Comentario
COMMENT ON POLICY "Authenticated users can upload to machine-files" ON storage.objects IS 
'Permite a usuarios autenticados subir archivos al bucket machine-files. El backend usa SERVICE_ROLE_KEY que bypassa RLS.';

-- NOTA: Si el bucket no existe, debe crearse manualmente desde Supabase Dashboard:
-- 1. Ir a Storage en Supabase Dashboard
-- 2. Crear bucket llamado 'machine-files'
-- 3. Configurar como privado (public: false)
-- 4. Establecer límite de tamaño de archivo a 50MB
-- 5. Configurar tipos MIME permitidos: image/jpeg, image/png, image/gif, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
