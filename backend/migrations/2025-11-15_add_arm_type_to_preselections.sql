-- Migration: add arm_type column to preselections
-- Run manually: psql -f backend/migrations/2025-11-15_add_arm_type_to_preselections.sql

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS arm_type VARCHAR(80) CHECK (arm_type IN ('ESTANDAR', 'N/A'));

COMMENT ON COLUMN preselections.arm_type IS 'Tipo de brazo: ESTANDAR o N/A';

