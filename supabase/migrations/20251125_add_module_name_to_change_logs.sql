-- Agregar columna module_name a change_logs para identificar el módulo de origen
ALTER TABLE change_logs
  ADD COLUMN IF NOT EXISTS module_name VARCHAR(50);

-- Índice para consultar por módulo
CREATE INDEX IF NOT EXISTS idx_change_logs_module
  ON change_logs(module_name);

-- Índice de apoyo para búsquedas por campo (se usa al compartir cambios entre módulos)
CREATE INDEX IF NOT EXISTS idx_change_logs_field_name
  ON change_logs(field_name);

COMMENT ON COLUMN change_logs.module_name IS
  'Módulo que originó el cambio: preseleccion, subasta, compras, logistica, equipos, servicio, importaciones, pagos, management, etc.';

