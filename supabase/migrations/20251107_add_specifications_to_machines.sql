-- Agregar especificaciones técnicas a la tabla machines
-- Estas especificaciones eran solo visibles en equipments, pero ahora estarán disponibles desde subastas

ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS machine_type TEXT,
ADD COLUMN IF NOT EXISTS wet_line TEXT CHECK (wet_line IN ('SI', 'No')),
ADD COLUMN IF NOT EXISTS arm_type TEXT CHECK (arm_type IN ('ESTANDAR', 'N/A')),
ADD COLUMN IF NOT EXISTS track_width NUMERIC,
ADD COLUMN IF NOT EXISTS bucket_capacity NUMERIC,
ADD COLUMN IF NOT EXISTS warranty_months INTEGER,
ADD COLUMN IF NOT EXISTS warranty_hours INTEGER,
ADD COLUMN IF NOT EXISTS engine_brand TEXT CHECK (engine_brand IN ('N/A', 'ISUZU', 'MITSUBISHI', 'FPT', 'YANMAR', 'KUBOTA', 'PERKINS', 'CUMMINS', 'CATERPILLAR', 'KOMATSU')),
ADD COLUMN IF NOT EXISTS cabin_type TEXT CHECK (cabin_type IN ('N/A', 'CABINA CERRADA / AIRE ACONDICIONADO', 'CANOPY')),
ADD COLUMN IF NOT EXISTS blade TEXT CHECK (blade IN ('SI', 'No'));

-- Crear índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_machines_machine_type ON machines(machine_type);
CREATE INDEX IF NOT EXISTS idx_machines_engine_brand ON machines(engine_brand);

-- Comentarios para documentación
COMMENT ON COLUMN machines.machine_type IS 'Tipo de máquina: EXCAVADORA, RETROEXCAVADORA, GRUA, etc.';
COMMENT ON COLUMN machines.wet_line IS 'Línea húmeda: SI o No';
COMMENT ON COLUMN machines.arm_type IS 'Tipo de brazo: ESTANDAR o N/A';
COMMENT ON COLUMN machines.track_width IS 'Ancho de zapatas en mm';
COMMENT ON COLUMN machines.bucket_capacity IS 'Capacidad del cucharón en m3';
COMMENT ON COLUMN machines.warranty_months IS 'Garantía en meses';
COMMENT ON COLUMN machines.warranty_hours IS 'Garantía en horas';
COMMENT ON COLUMN machines.engine_brand IS 'Marca del motor';
COMMENT ON COLUMN machines.cabin_type IS 'Tipo de cabina';
COMMENT ON COLUMN machines.blade IS 'Tiene Blade (cuchilla): SI o No';

