-- Sistema de Control de Cambios (Audit Trail)
-- Fecha: 2025-11-07

-- Crear tabla de logs de cambios
CREATE TABLE IF NOT EXISTS change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  changed_by UUID REFERENCES users_profile(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_change_logs_record ON change_logs(table_name, record_id);
CREATE INDEX idx_change_logs_date ON change_logs(changed_at DESC);
CREATE INDEX idx_change_logs_user ON change_logs(changed_by);

-- Comentarios
COMMENT ON TABLE change_logs IS 'Registro de auditoría de cambios en registros importantes';
COMMENT ON COLUMN change_logs.table_name IS 'Nombre de la tabla modificada (purchases, equipments, service_records)';
COMMENT ON COLUMN change_logs.record_id IS 'ID del registro modificado';
COMMENT ON COLUMN change_logs.field_name IS 'Nombre del campo que cambió';
COMMENT ON COLUMN change_logs.old_value IS 'Valor anterior del campo';
COMMENT ON COLUMN change_logs.new_value IS 'Valor nuevo del campo';
COMMENT ON COLUMN change_logs.change_reason IS 'Razón del cambio (opcional)';
COMMENT ON COLUMN change_logs.changed_by IS 'Usuario que realizó el cambio';
COMMENT ON COLUMN change_logs.changed_at IS 'Fecha y hora del cambio';

