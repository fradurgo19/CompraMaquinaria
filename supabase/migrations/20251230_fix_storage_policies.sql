-- Migration: Fix Storage Bucket Policies
-- Created: 2025-12-30
-- Description: Corrige políticas RLS para buckets de Supabase Storage según lógica del backend
-- IMPORTANTE: Ejecutar desde SQL Editor de Supabase (requiere permisos de superusuario)

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Authenticated users can view uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete machine-files" ON storage.objects;
DROP POLICY IF EXISTS "Purchase roles can view purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Purchase roles can upload to purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Purchase roles can update purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Purchase roles can delete purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Purchase roles can view new-purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Purchase roles can upload to new-purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Purchase roles can update new-purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete new-purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Commercial roles can view equipment-reservations" ON storage.objects;
DROP POLICY IF EXISTS "Commercial roles can upload to equipment-reservations" ON storage.objects;
DROP POLICY IF EXISTS "Commercial roles can update equipment-reservations" ON storage.objects;
DROP POLICY IF EXISTS "Commercial roles can delete equipment-reservations" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view new-purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to new-purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update new-purchase-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view equipment-reservations" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to equipment-reservations" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update equipment-reservations" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete equipment-reservations" ON storage.objects;

-- =====================================================
-- BUCKET: uploads
-- Backend: /api/upload - requiere authenticateToken (todos autenticados)
-- =====================================================

CREATE POLICY "Authenticated users can view uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can upload to uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can update their uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can delete their uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- BUCKET: machine-files
-- Backend: /api/files - requiere authenticateToken (todos autenticados)
-- DELETE: solo el que subió o admin
-- =====================================================

CREATE POLICY "Authenticated users can view machine-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'machine-files');

CREATE POLICY "Authenticated users can upload to machine-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'machine-files');

CREATE POLICY "Users can update machine-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'machine-files');

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

-- =====================================================
-- BUCKET: purchase-files
-- Backend: Ver: canViewPurchases (eliana, gerencia, admin, importaciones, logistica, sebastian)
--         Subir: canEditPurchases (eliana, gerencia, admin)
--         DELETE: solo el que subió o admin
-- =====================================================

CREATE POLICY "Purchase roles can view purchase-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'purchase-files'
  AND public.get_user_role_from_storage() IN ('eliana', 'gerencia', 'admin', 'importaciones', 'logistica', 'sebastian', 'pagos')
);

CREATE POLICY "Purchase roles can upload to purchase-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'purchase-files'
  AND public.get_user_role_from_storage() IN ('eliana', 'gerencia', 'admin')
);

CREATE POLICY "Purchase roles can update purchase-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'purchase-files'
  AND public.get_user_role_from_storage() IN ('eliana', 'gerencia', 'admin')
);

CREATE POLICY "Purchase roles can delete purchase-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'purchase-files'
  AND (
    public.get_user_role_from_storage() = 'admin'
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- =====================================================
-- BUCKET: new-purchase-files
-- Backend: /api/files/new-purchases - requiere authenticateToken (todos autenticados)
-- DELETE: solo el que subió o admin
-- =====================================================

CREATE POLICY "Authenticated users can view new-purchase-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'new-purchase-files');

CREATE POLICY "Authenticated users can upload to new-purchase-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'new-purchase-files');

CREATE POLICY "Authenticated users can update new-purchase-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'new-purchase-files');

CREATE POLICY "Users can delete new-purchase-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'new-purchase-files'
  AND (
    public.get_user_role_from_storage() = 'admin'
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- =====================================================
-- BUCKET: equipment-reservations
-- Backend: /api/upload - requiere authenticateToken (todos autenticados)
-- DELETE: solo el que subió o admin
-- =====================================================

CREATE POLICY "Authenticated users can view equipment-reservations"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'equipment-reservations');

CREATE POLICY "Authenticated users can upload to equipment-reservations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'equipment-reservations');

CREATE POLICY "Authenticated users can update equipment-reservations"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'equipment-reservations');

CREATE POLICY "Users can delete equipment-reservations"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'equipment-reservations'
  AND (
    public.get_user_role_from_storage() = 'admin'
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

