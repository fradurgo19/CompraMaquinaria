-- =====================================================
-- Migración: Agregar carpeta FACTURA PROFORMA a purchase_files
-- Fecha: 2025-01-15
-- Descripción: Agrega la carpeta FACTURA PROFORMA a las opciones permitidas
-- =====================================================

-- Eliminar constraint existente
ALTER TABLE purchase_files
  DROP CONSTRAINT IF EXISTS purchase_files_folder_check;

-- Agregar nuevo constraint con FACTURA PROFORMA
ALTER TABLE purchase_files
  ADD CONSTRAINT purchase_files_folder_check 
  CHECK (folder IN ('LAVADO', 'SERIALES', 'DOCUMENTOS DEFINITIVOS', 'CARGUE', 'FACTURA PROFORMA'));

-- Comentario
COMMENT ON COLUMN purchase_files.folder IS 'Carpeta del archivo: LAVADO, SERIALES, DOCUMENTOS DEFINITIVOS, CARGUE, FACTURA PROFORMA';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
