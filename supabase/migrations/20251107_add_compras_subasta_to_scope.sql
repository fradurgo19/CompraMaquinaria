-- Agregar 'COMPRAS', 'SUBASTA' e 'IMPORTACIONES' al scope de machine_files
-- Fecha: 2025-11-07

-- Eliminar la restricción antigua
ALTER TABLE machine_files
DROP CONSTRAINT IF EXISTS machine_files_scope_check;

-- Crear la nueva restricción con todos los módulos incluidos
ALTER TABLE machine_files
ADD CONSTRAINT machine_files_scope_check 
CHECK (scope IN ('GENERAL', 'SUBASTA', 'COMPRAS', 'IMPORTACIONES', 'LOGISTICA', 'EQUIPOS', 'SERVICIO'));

-- Confirmar cambio
COMMENT ON CONSTRAINT machine_files_scope_check ON machine_files IS 
'Valores permitidos: GENERAL, SUBASTA, COMPRAS, IMPORTACIONES, LOGISTICA, EQUIPOS, SERVICIO';

