-- Migration: Setup Storage Bucket Policies
-- Created: 2025-12-30
-- Description: Configura políticas RLS para buckets de Supabase Storage según roles

-- Función helper para obtener el rol del usuario desde users_profile
CREATE OR REPLACE FUNCTION public.get_user_role_from_storage()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users_profile
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role, 'anonymous');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- BUCKET: uploads
-- Acceso: Todos los usuarios autenticados pueden subir y ver
-- =====================================================

-- Política para SELECT (ver archivos)
CREATE POLICY "Authenticated users can view uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'uploads');

-- Política para INSERT (subir archivos)
CREATE POLICY "Authenticated users can upload to uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Política para UPDATE (actualizar archivos)
CREATE POLICY "Authenticated users can update their uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Política para DELETE (eliminar archivos)
CREATE POLICY "Authenticated users can delete their uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- BUCKET: machine-files
-- Acceso: Todos pueden ver, solo ciertos roles pueden subir/eliminar
-- =====================================================

-- Política para SELECT (ver archivos)
CREATE POLICY "Authenticated users can view machine-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'machine-files');

-- Política para INSERT (subir archivos) - Todos los autenticados
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

-- =====================================================
-- BUCKET: purchase-files
-- Acceso: Ver: canViewPurchases (eliana, gerencia, admin, importaciones, logistica, sebastian)
--         Subir: canEditPurchases (eliana, gerencia, admin)
-- =====================================================

-- Política para SELECT (ver archivos) - canViewPurchases
CREATE POLICY "Purchase roles can view purchase-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'purchase-files'
  AND public.get_user_role_from_storage() IN ('eliana', 'gerencia', 'admin', 'importaciones', 'logistica', 'sebastian', 'pagos')
);

-- Política para INSERT (subir archivos) - canEditPurchases
CREATE POLICY "Purchase roles can upload to purchase-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'purchase-files'
  AND public.get_user_role_from_storage() IN ('eliana', 'gerencia', 'admin')
);

-- Política para UPDATE (actualizar archivos) - canEditPurchases
CREATE POLICY "Purchase roles can update purchase-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'purchase-files'
  AND public.get_user_role_from_storage() IN ('eliana', 'gerencia', 'admin')
);

-- Política para DELETE (eliminar archivos)
CREATE POLICY "Purchase roles can delete purchase-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'purchase-files'
  AND (
    public.get_user_role_from_storage() = 'admin'
    OR public.get_user_role_from_storage() IN ('eliana', 'importaciones', 'logistica', 'gerencia', 'pagos')
  )
);

-- =====================================================
-- BUCKET: new-purchase-files
-- Acceso: Todos los autenticados (el backend controla permisos)
-- Backend: /api/files/new-purchases requiere authenticateToken (todos autenticados)
-- =====================================================

-- Política para SELECT (ver archivos) - Todos autenticados
CREATE POLICY "Authenticated users can view new-purchase-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'new-purchase-files');

-- Política para INSERT (subir archivos) - Todos autenticados
CREATE POLICY "Authenticated users can upload to new-purchase-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'new-purchase-files');

-- Política para UPDATE (actualizar archivos) - Todos autenticados
CREATE POLICY "Authenticated users can update new-purchase-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'new-purchase-files');

-- Política para DELETE (eliminar archivos) - Solo admin o el que subió
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
-- Acceso: Todos los autenticados (el backend controla permisos)
-- Backend: /api/upload requiere authenticateToken (todos autenticados)
-- Nota: El uso real es para comerciales, pero el backend valida permisos
-- =====================================================

-- Política para SELECT (ver archivos) - Todos autenticados
CREATE POLICY "Authenticated users can view equipment-reservations"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'equipment-reservations');

-- Política para INSERT (subir archivos) - Todos autenticados
CREATE POLICY "Authenticated users can upload to equipment-reservations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'equipment-reservations');

-- Política para UPDATE (actualizar archivos) - Todos autenticados
CREATE POLICY "Authenticated users can update equipment-reservations"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'equipment-reservations');

-- Política para DELETE (eliminar archivos) - Solo admin o el que subió
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

-- Comentarios
COMMENT ON FUNCTION public.get_user_role_from_storage() IS 'Obtiene el rol del usuario actual desde users_profile para políticas de Storage';

