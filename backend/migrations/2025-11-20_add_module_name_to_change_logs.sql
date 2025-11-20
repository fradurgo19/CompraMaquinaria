-- Agregar columna module_name a change_logs para identificar el módulo que realizó el cambio
ALTER TABLE change_logs
  ADD COLUMN IF NOT EXISTS module_name VARCHAR(50);

-- Crear índice para búsquedas por módulo
CREATE INDEX IF NOT EXISTS idx_change_logs_module ON change_logs(module_name);

-- Crear índice para búsquedas por field_name (para encontrar cambios entre módulos)
CREATE INDEX IF NOT EXISTS idx_change_logs_field_name ON change_logs(field_name);

-- Comentario
COMMENT ON COLUMN change_logs.module_name IS 'Módulo que realizó el cambio: preseleccion, subasta, compras, logistica, equipos, servicio, importaciones, pagos';

