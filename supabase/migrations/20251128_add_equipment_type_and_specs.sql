-- =====================================================
-- MIGRACIÓN: Agregar TIPO EQUIPO y SPEC a new_purchases
-- =====================================================
-- Esta migración agrega las columnas para tipo de equipo
-- y especificaciones técnicas a la tabla new_purchases
-- =====================================================

-- Agregar columna TIPO EQUIPO
ALTER TABLE new_purchases
  ADD COLUMN IF NOT EXISTS equipment_type VARCHAR(50);

-- Agregar columnas de especificaciones técnicas
ALTER TABLE new_purchases
  ADD COLUMN IF NOT EXISTS cabin_type VARCHAR(50), -- TIPO CABINA
  ADD COLUMN IF NOT EXISTS wet_line VARCHAR(10), -- LINEA HUMEDA (SI/NO)
  ADD COLUMN IF NOT EXISTS dozer_blade VARCHAR(10), -- HOJA TOPADORA (SI/NO)
  ADD COLUMN IF NOT EXISTS track_type VARCHAR(50), -- TIPO ZAPATA
  ADD COLUMN IF NOT EXISTS track_width VARCHAR(50); -- ANCHO ZAPATA

-- Comentarios
COMMENT ON COLUMN new_purchases.equipment_type IS 'Tipo de equipo: ALIMENTADOR VIBRATORIO, BULLDOZER, EXCAVADORA, etc.';
COMMENT ON COLUMN new_purchases.cabin_type IS 'Tipo de cabina: CANOPY o CAB CERRADA';
COMMENT ON COLUMN new_purchases.wet_line IS 'Línea húmeda: SI o NO';
COMMENT ON COLUMN new_purchases.dozer_blade IS 'Hoja topadora: SI o NO';
COMMENT ON COLUMN new_purchases.track_type IS 'Tipo de zapata: STEEL TRACK o RUBBER TRACK';
COMMENT ON COLUMN new_purchases.track_width IS 'Ancho de zapata en mm';

