-- Alinea constraint de arm_type en machines para permitir LONG ARM
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_arm_type_check;
ALTER TABLE machines
  ADD CONSTRAINT machines_arm_type_check
  CHECK (arm_type IS NULL OR arm_type IN ('ESTANDAR', 'N/A', 'LONG ARM'));
COMMENT ON COLUMN machines.arm_type IS 'Tipo de brazo: ESTANDAR, N/A o LONG ARM';

