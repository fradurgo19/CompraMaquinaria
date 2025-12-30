-- Migration: add shoe_width_mm column to machine_spec_defaults table
-- Created: 2025-11-15
-- Description: Add shoe width column to machine spec defaults

ALTER TABLE public.machine_spec_defaults
  ADD COLUMN IF NOT EXISTS shoe_width_mm NUMERIC;

COMMENT ON COLUMN public.machine_spec_defaults.shoe_width_mm IS 'Ancho de zapatas en mm por defecto';

