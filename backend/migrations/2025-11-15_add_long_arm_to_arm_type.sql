-- Migration: add LONG ARM option to arm_type column in preselections
-- Run manually: psql -U postgres -d maquinaria_usada -f backend/migrations/2025-11-15_add_long_arm_to_arm_type.sql

-- Primero, eliminar el constraint existente
ALTER TABLE preselections
  DROP CONSTRAINT IF EXISTS preselections_arm_type_check;

-- Agregar el nuevo constraint con LONG ARM incluido
ALTER TABLE preselections
  ADD CONSTRAINT preselections_arm_type_check 
  CHECK (arm_type IS NULL OR arm_type IN ('ESTANDAR', 'N/A', 'LONG ARM'));

COMMENT ON COLUMN preselections.arm_type IS 'Tipo de brazo: ESTANDAR, N/A o LONG ARM';

