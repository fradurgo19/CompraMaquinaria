-- Migration: Add CONSOLIDADO, SUBASTA, COMPRAS, IMPORTACIONES to machine_files scope
-- Date: 2025-12-04
-- Purpose: Permitir el scope CONSOLIDADO y otros módulos en la gestión de archivos

-- 1. Eliminar constraint antiguo
ALTER TABLE machine_files 
DROP CONSTRAINT IF EXISTS machine_files_scope_check;

-- 2. Agregar nuevo constraint con todos los módulos
ALTER TABLE machine_files 
ADD CONSTRAINT machine_files_scope_check 
CHECK (scope IN (
  'GENERAL',
  'SUBASTA',
  'COMPRAS',
  'IMPORTACIONES',
  'LOGISTICA',
  'EQUIPOS',
  'SERVICIO',
  'CONSOLIDADO'
));

-- 3. Actualizar comentario
COMMENT ON COLUMN machine_files.scope IS 'Contexto del archivo: GENERAL, SUBASTA, COMPRAS, IMPORTACIONES, LOGISTICA, EQUIPOS, SERVICIO, CONSOLIDADO';

