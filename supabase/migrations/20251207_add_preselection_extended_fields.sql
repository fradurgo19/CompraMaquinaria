-- Migration: Add extended fields to preselections table
-- Fecha: 2025-12-07
-- Descripción: Agregar campos adicionales que existen en local pero faltan en Supabase

-- Campos inline de edición
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS auction_type VARCHAR(120);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS auction_country VARCHAR(120);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS currency VARCHAR(12) DEFAULT 'USD';

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS location VARCHAR(150);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS final_price NUMERIC(12, 2);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS shoe_width_mm NUMERIC;

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_pip BOOLEAN DEFAULT FALSE;

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_blade BOOLEAN DEFAULT FALSE;

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_cabin VARCHAR(80);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS local_time VARCHAR(10);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS auction_city VARCHAR(100);

-- Columna para tiempo Colombia
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS colombia_time TIMESTAMPTZ;

-- Columna arm_type con constraint
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS arm_type VARCHAR(80);

-- Actualizar constraint de arm_type (puede ser ESTANDAR, N/A o LONG ARM)
ALTER TABLE preselections
  DROP CONSTRAINT IF EXISTS preselections_arm_type_check;

ALTER TABLE preselections
  ADD CONSTRAINT preselections_arm_type_check 
  CHECK (arm_type IS NULL OR arm_type IN ('ESTANDAR', 'N/A', 'LONG ARM'));

-- Comentarios
COMMENT ON COLUMN preselections.auction_type IS 'Tipo de subasta';
COMMENT ON COLUMN preselections.auction_country IS 'País de la subasta';
COMMENT ON COLUMN preselections.currency IS 'Moneda de la subasta';
COMMENT ON COLUMN preselections.location IS 'Ubicación de la subasta';
COMMENT ON COLUMN preselections.final_price IS 'Precio final de la subasta';
COMMENT ON COLUMN preselections.shoe_width_mm IS 'Ancho de zapatas en mm';
COMMENT ON COLUMN preselections.spec_pip IS 'Especificación PIP';
COMMENT ON COLUMN preselections.spec_blade IS 'Especificación Blade';
COMMENT ON COLUMN preselections.spec_cabin IS 'Especificación de cabina';
COMMENT ON COLUMN preselections.local_time IS 'Hora local de la subasta';
COMMENT ON COLUMN preselections.auction_city IS 'Ciudad de la subasta';
COMMENT ON COLUMN preselections.colombia_time IS 'Hora calculada en zona horaria de Colombia';
COMMENT ON COLUMN preselections.arm_type IS 'Tipo de brazo: ESTANDAR, N/A o LONG ARM';

