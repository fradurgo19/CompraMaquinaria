-- Migration: add shoe_width_mm column to machine_spec_defaults table
-- Run manually: psql -U postgres -d maquinaria_usada -f backend/migrations/2025-11-15_add_shoe_width_to_spec_defaults.sql

ALTER TABLE machine_spec_defaults
  ADD COLUMN IF NOT EXISTS shoe_width_mm NUMERIC;

COMMENT ON COLUMN machine_spec_defaults.shoe_width_mm IS 'Ancho de zapatas en mm por defecto';

