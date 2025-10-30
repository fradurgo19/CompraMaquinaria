-- Agregar columnas de fechas de alistamiento a la tabla equipments
-- Estas fechas se sincronizan automáticamente desde service_records

ALTER TABLE equipments
ADD COLUMN IF NOT EXISTS start_staging DATE,
ADD COLUMN IF NOT EXISTS end_staging DATE;

-- Agregar índices para mejorar búsquedas por fechas de alistamiento
CREATE INDEX IF NOT EXISTS idx_equipments_start_staging ON equipments(start_staging);
CREATE INDEX IF NOT EXISTS idx_equipments_end_staging ON equipments(end_staging);

-- Comentarios
COMMENT ON COLUMN equipments.start_staging IS 'Fecha de inicio de alistamiento (sincronizado desde service_records)';
COMMENT ON COLUMN equipments.end_staging IS 'Fecha de fin de alistamiento (sincronizado desde service_records)';

