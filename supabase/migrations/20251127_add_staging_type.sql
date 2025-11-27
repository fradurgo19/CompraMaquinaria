-- Agregar columna tipo_alistamiento (staging_type) a service_records
ALTER TABLE service_records 
ADD COLUMN IF NOT EXISTS staging_type VARCHAR(20) DEFAULT NULL;

-- Agregar constraint para valores permitidos en service_records
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_records_staging_type_check') THEN
    ALTER TABLE service_records 
    ADD CONSTRAINT service_records_staging_type_check 
    CHECK (staging_type IS NULL OR staging_type IN ('NORMAL', 'ADICIONAL'));
  END IF;
END $$;

-- Comentario descriptivo
COMMENT ON COLUMN service_records.staging_type IS 'Tipo de alistamiento: NORMAL o ADICIONAL';

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_service_records_staging_type ON service_records(staging_type);

-- Agregar columna staging_type a equipments (sincronizada desde service_records)
ALTER TABLE equipments 
ADD COLUMN IF NOT EXISTS staging_type VARCHAR(20) DEFAULT NULL;

-- Agregar constraint para valores permitidos en equipments
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipments_staging_type_check') THEN
    ALTER TABLE equipments 
    ADD CONSTRAINT equipments_staging_type_check 
    CHECK (staging_type IS NULL OR staging_type IN ('NORMAL', 'ADICIONAL'));
  END IF;
END $$;

-- Comentario descriptivo
COMMENT ON COLUMN equipments.staging_type IS 'Tipo de alistamiento: NORMAL o ADICIONAL (sincronizado desde service_records)';

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_equipments_staging_type ON equipments(staging_type);

