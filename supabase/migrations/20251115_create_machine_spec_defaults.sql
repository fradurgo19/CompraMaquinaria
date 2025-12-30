-- Migration: create machine_spec_defaults table for storing default specifications by brand/model
-- Created: 2025-11-15
-- Description: Create table to store default machine specifications by brand and model

CREATE TABLE IF NOT EXISTS public.machine_spec_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(255) NOT NULL,
  capacidad VARCHAR(50) CHECK (capacidad IN ('MINIS', 'MEDIANAS', 'GRANDES')),
  tonelage VARCHAR(50) CHECK (tonelage IN ('1.7-5.5 TONELADAS', '7.5-13.5 TONELADAS', '20.0-ADELANTE TONELADAS')),
  spec_blade BOOLEAN DEFAULT FALSE,
  spec_pip BOOLEAN DEFAULT FALSE,
  spec_cabin VARCHAR(80),
  arm_type VARCHAR(80) CHECK (arm_type IN ('ESTANDAR', 'N/A', 'LONG ARM')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand, model)
);

CREATE INDEX IF NOT EXISTS idx_machine_spec_defaults_brand_model ON public.machine_spec_defaults(brand, model);
CREATE INDEX IF NOT EXISTS idx_machine_spec_defaults_brand ON public.machine_spec_defaults(brand);

COMMENT ON TABLE public.machine_spec_defaults IS 'Especificaciones por defecto para máquinas por marca y modelo';
COMMENT ON COLUMN public.machine_spec_defaults.brand IS 'Marca de la máquina (ej: HITACHI)';
COMMENT ON COLUMN public.machine_spec_defaults.model IS 'Modelo de la máquina (ej: ZX17, ZX30, etc.)';
COMMENT ON COLUMN public.machine_spec_defaults.capacidad IS 'Capacidad: MINIS, MEDIANAS, GRANDES';
COMMENT ON COLUMN public.machine_spec_defaults.tonelage IS 'Tonelaje: 1.7-5.5 TONELADAS, 7.5-13.5 TONELADAS, 20.0-ADELANTE TONELADAS';
COMMENT ON COLUMN public.machine_spec_defaults.spec_blade IS 'Tiene Blade por defecto';
COMMENT ON COLUMN public.machine_spec_defaults.spec_pip IS 'Tiene PIP por defecto';
COMMENT ON COLUMN public.machine_spec_defaults.spec_cabin IS 'Tipo de cabina por defecto';
COMMENT ON COLUMN public.machine_spec_defaults.arm_type IS 'Tipo de brazo por defecto';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_machine_spec_defaults_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_machine_spec_defaults_updated_at
  BEFORE UPDATE ON public.machine_spec_defaults
  FOR EACH ROW
  EXECUTE FUNCTION public.update_machine_spec_defaults_updated_at();

-- RLS: keep disabled for now; Vercel backend uses service role. Enable and add policies when exposing via anon key.
ALTER TABLE public.machine_spec_defaults DISABLE ROW LEVEL SECURITY;

