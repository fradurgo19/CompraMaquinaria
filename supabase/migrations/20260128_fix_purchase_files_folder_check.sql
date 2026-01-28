-- Migration: Fix purchase_files folder constraint
-- Created: 2026-01-28
-- Description: Ensure FACTURA PROFORMA is allowed in purchase_files.folder

-- Eliminar constraint existente
ALTER TABLE purchase_files
  DROP CONSTRAINT IF EXISTS purchase_files_folder_check;

-- Agregar constraint con todas las carpetas permitidas
ALTER TABLE purchase_files
  ADD CONSTRAINT purchase_files_folder_check
  CHECK (folder IN ('LAVADO', 'SERIALES', 'DOCUMENTOS DEFINITIVOS', 'CARGUE', 'FACTURA PROFORMA'));

-- Comentario actualizado
COMMENT ON COLUMN purchase_files.folder IS 'Carpeta del archivo: LAVADO, SERIALES, DOCUMENTOS DEFINITIVOS, CARGUE, FACTURA PROFORMA';
