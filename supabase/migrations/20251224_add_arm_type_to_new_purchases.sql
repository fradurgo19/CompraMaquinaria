-- Agregar columna arm_type a new_purchases para soportar Brazo (ESTANDAR, LONG ARM, N/A)

ALTER TABLE new_purchases
ADD COLUMN IF NOT EXISTS arm_type VARCHAR(80);

-- Constraint de validación
ALTER TABLE new_purchases
DROP CONSTRAINT IF EXISTS new_purchases_arm_type_check;

ALTER TABLE new_purchases
ADD CONSTRAINT new_purchases_arm_type_check
CHECK (arm_type IS NULL OR arm_type IN ('ESTANDAR', 'LONG ARM', 'N/A'));

COMMENT ON COLUMN new_purchases.arm_type IS 'Tipo de brazo: ESTANDAR, LONG ARM o N/A';

