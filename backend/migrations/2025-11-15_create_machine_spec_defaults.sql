-- Migration: create machine_spec_defaults table for storing default specifications by brand/model
-- Run manually: psql -U postgres -d maquinaria_usada -f backend/migrations/2025-11-15_create_machine_spec_defaults.sql

CREATE TABLE IF NOT EXISTS machine_spec_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(255) NOT NULL,
  capacidad VARCHAR(50) CHECK (capacidad IN ('MINIS', 'MEDIANAS', 'GRANDES')),
  tonelage VARCHAR(50) CHECK (tonelage IN ('1.7-5.5 TONELADAS', '7.5-13.5 TONELADAS', '20.0-ADELANTE TONELADAS')),
  spec_blade BOOLEAN DEFAULT FALSE,
  spec_pip BOOLEAN DEFAULT FALSE,
  spec_cabin VARCHAR(80),
  arm_type VARCHAR(80) CHECK (arm_type IN ('ESTANDAR', 'N/A', 'LONG ARM')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brand, model)
);

CREATE INDEX IF NOT EXISTS idx_machine_spec_defaults_brand_model ON machine_spec_defaults(brand, model);
CREATE INDEX IF NOT EXISTS idx_machine_spec_defaults_brand ON machine_spec_defaults(brand);

COMMENT ON TABLE machine_spec_defaults IS 'Especificaciones por defecto para máquinas por marca y modelo';
COMMENT ON COLUMN machine_spec_defaults.brand IS 'Marca de la máquina (ej: HITACHI)';
COMMENT ON COLUMN machine_spec_defaults.model IS 'Modelo de la máquina (ej: ZX17, ZX30, etc.)';
COMMENT ON COLUMN machine_spec_defaults.capacidad IS 'Capacidad: MINIS, MEDIANAS, GRANDES';
COMMENT ON COLUMN machine_spec_defaults.tonelage IS 'Tonelaje: 1.7-5.5 TONELADAS, 7.5-13.5 TONELADAS, 20.0-ADELANTE TONELADAS';
COMMENT ON COLUMN machine_spec_defaults.spec_blade IS 'Tiene Blade por defecto';
COMMENT ON COLUMN machine_spec_defaults.spec_pip IS 'Tiene PIP por defecto';
COMMENT ON COLUMN machine_spec_defaults.spec_cabin IS 'Tipo de cabina por defecto';
COMMENT ON COLUMN machine_spec_defaults.arm_type IS 'Tipo de brazo por defecto';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_machine_spec_defaults_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_machine_spec_defaults_updated_at
  BEFORE UPDATE ON machine_spec_defaults
  FOR EACH ROW
  EXECUTE FUNCTION update_machine_spec_defaults_updated_at();

