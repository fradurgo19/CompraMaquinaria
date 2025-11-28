-- =====================================================
-- MIGRACIÓN: Tabla para especificaciones por defecto de modelos
-- =====================================================
-- Esta tabla almacena las especificaciones técnicas por defecto
-- para cada modelo de máquina según su condición (NUEVA/USADA)
-- =====================================================

CREATE TABLE IF NOT EXISTS model_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model VARCHAR(100) NOT NULL,
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('NUEVA', 'USADA')),
  cabin_type VARCHAR(50),
  wet_line VARCHAR(10) CHECK (wet_line IN ('SI', 'NO')),
  dozer_blade VARCHAR(10) CHECK (dozer_blade IN ('SI', 'NO')),
  track_type VARCHAR(50),
  track_width VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users_profile(id),
  UNIQUE(model, condition)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_model_specs_model ON model_specifications(model);
CREATE INDEX IF NOT EXISTS idx_model_specs_condition ON model_specifications(condition);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_model_specs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_specs_updated_at
  BEFORE UPDATE ON model_specifications
  FOR EACH ROW
  EXECUTE FUNCTION update_model_specs_updated_at();

-- Comentarios
COMMENT ON TABLE model_specifications IS 'Especificaciones técnicas por defecto para modelos de máquinas';
COMMENT ON COLUMN model_specifications.model IS 'Modelo de la máquina (ej: ZX200-6)';
COMMENT ON COLUMN model_specifications.condition IS 'Condición: NUEVA o USADA';
COMMENT ON COLUMN model_specifications.cabin_type IS 'Tipo de cabina: CANOPY o CAB CERRADA';
COMMENT ON COLUMN model_specifications.wet_line IS 'Línea húmeda: SI o NO';
COMMENT ON COLUMN model_specifications.dozer_blade IS 'Hoja topadora: SI o NO';
COMMENT ON COLUMN model_specifications.track_type IS 'Tipo de zapata: STEEL TRACK o RUBBER TRACK';
COMMENT ON COLUMN model_specifications.track_width IS 'Ancho de zapata (ej: 230 mm)';

-- Insertar especificaciones por defecto desde el archivo de constantes
INSERT INTO model_specifications (model, condition, cabin_type, wet_line, dozer_blade, track_type, track_width)
VALUES
  ('VIO17-1B', 'NUEVA', 'CANOPY', 'SI', 'SI', 'STEEL TRACK', '230 mm'),
  ('ZX17U-5A', 'USADA', 'CANOPY', 'SI', 'SI', 'STEEL TRACK', '230 mm'),
  ('ZX30U-5A', 'USADA', 'CANOPY', 'SI', 'SI', 'STEEL TRACK', '300 mm'),
  ('VIO35-7', 'NUEVA', 'CANOPY', 'SI', 'SI', 'STEEL TRACK', '300 mm'),
  ('ZX40U-5B', 'USADA', 'CANOPY', 'SI', 'SI', 'STEEL TRACK', '350 mm'),
  ('VIO50-7', 'NUEVA', 'CAB CERRADA', 'SI', 'SI', 'STEEL TRACK', '400 mm'),
  ('AX50-3', 'USADA', 'CANOPY', 'SI', 'SI', 'STEEL TRACK', '400 mm'),
  ('ZX75US-5B', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '450 mm'),
  ('ZX75USK-5B', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '450 mm'),
  ('ZX75-7', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '450 mm'),
  ('VIO80-7', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '450 mm'),
  ('909F', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '450 mm'),
  ('ZX120-6', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '600mm'),
  ('ZX135US-6', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '500mm'),
  ('ZX135USK-5B', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '500mm'),
  ('ZX135US-5B', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '500mm'),
  ('ZX130-5B', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '700mm'),
  ('915F', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '600mm'),
  ('920F', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '800mm'),
  ('922F', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '800mm'),
  ('ZX200-6', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '600mm'),
  ('ZX200LC-5B', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '700mm'),
  ('ZX225USR-6', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '600mm'),
  ('ZX210LC-5B', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '800mm'),
  ('ZX350LC-6N', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '800mm'),
  ('ZX350H-5B', 'USADA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '800mm'),
  ('ZX350LC-5B', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '800mm'),
  ('933F', 'NUEVA', 'CAB CERRADA', 'NO', 'NO', 'STEEL TRACK', '800mm')
ON CONFLICT (model, condition) DO NOTHING;

