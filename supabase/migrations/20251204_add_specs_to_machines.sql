-- Migration: Add specification fields to machines table
-- Date: 2025-12-04
-- Purpose: Enable specifications flow from preselection → auctions → purchases → equipments

-- 1. Add specification fields to machines table
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS shoe_width_mm INTEGER,
ADD COLUMN IF NOT EXISTS spec_pip BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS spec_blade BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS spec_cabin VARCHAR(100),
ADD COLUMN IF NOT EXISTS arm_type VARCHAR(80) CHECK (arm_type IN ('ESTANDAR', 'N/A', 'LONG ARM', NULL));

-- 2. Add blade field to equipments table (missing field)
ALTER TABLE equipments
ADD COLUMN IF NOT EXISTS blade TEXT CHECK (blade IN ('SI', 'No', NULL));

-- 3. Update arm_type CHECK constraint in equipments to include LONG ARM
ALTER TABLE equipments DROP CONSTRAINT IF EXISTS equipments_arm_type_check;
ALTER TABLE equipments 
ADD CONSTRAINT equipments_arm_type_check 
CHECK (arm_type IN ('ESTANDAR', 'N/A', 'LONG ARM', NULL));

-- 4. Update cabin_type CHECK constraint in equipments to match machines
ALTER TABLE equipments DROP CONSTRAINT IF EXISTS equipments_cabin_type_check;
ALTER TABLE equipments 
ADD CONSTRAINT equipments_cabin_type_check 
CHECK (cabin_type IN ('N/A', 'CABINA CERRADA / AIRE ACONDICIONADO', 'CANOPY', 'CABINA CERRADA/AC', 'CABINA CERRADA', NULL));

-- 5. Add comments
COMMENT ON COLUMN machines.shoe_width_mm IS 'Ancho de zapatas en mm';
COMMENT ON COLUMN machines.spec_pip IS 'Tiene PIP (accesorios)';
COMMENT ON COLUMN machines.spec_blade IS 'Tiene Blade (hoja topadora)';
COMMENT ON COLUMN machines.spec_cabin IS 'Tipo de cabina';
COMMENT ON COLUMN machines.arm_type IS 'Tipo de brazo: ESTANDAR, N/A, LONG ARM';
COMMENT ON COLUMN equipments.blade IS 'Tiene blade/hoja topadora: SI o No';

-- 6. Create index for spec queries
CREATE INDEX IF NOT EXISTS idx_machines_brand_model ON machines(brand, model);

