-- Agregar columna TIPO MAQUINA a módulos clave

-- Preselección
ALTER TABLE preselections
ADD COLUMN IF NOT EXISTS machine_type TEXT;

COMMENT ON COLUMN preselections.machine_type IS 'Tipo de máquina (Excavadora, Cargador, Minicargador, etc)';

-- Compras Nuevos (new_purchases)
ALTER TABLE new_purchases
ADD COLUMN IF NOT EXISTS machine_type TEXT;

COMMENT ON COLUMN new_purchases.machine_type IS 'Tipo de máquina (Excavadora, Cargador, Minicargador, etc)';

-- Servicio (para poder almacenar el valor si se requiere en el futuro)
ALTER TABLE service_records
ADD COLUMN IF NOT EXISTS machine_type TEXT;

COMMENT ON COLUMN service_records.machine_type IS 'Tipo de máquina';
