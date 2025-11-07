-- Agregar columna blade a equipments para consistencia
ALTER TABLE equipments 
ADD COLUMN IF NOT EXISTS blade TEXT CHECK (blade IN ('SI', 'No'));

-- Comentario
COMMENT ON COLUMN equipments.blade IS 'Tiene Blade (cuchilla): SI o No';

