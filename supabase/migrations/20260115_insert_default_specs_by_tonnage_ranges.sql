-- Migration: Insertar especificaciones por defecto según rangos de toneladas
-- Created: 2026-01-15
-- Description: Inserta todas las especificaciones por defecto para los modelos Hitachi según los rangos de toneladas definidos

-- Insertar especificaciones por defecto de máquinas
-- Usar ON CONFLICT para actualizar si ya existen

INSERT INTO public.machine_spec_defaults (brand, model, tonelage, spec_blade, spec_pip, spec_cabin, shoe_width_mm, arm_type)
VALUES
  -- Rango 1.5 - 2.9 TON
  ('HITACHI', 'ZX17U-2', '1.5 - 2.9', true, true, 'CANOPY', 230, 'ESTANDAR'),
  ('HITACHI', 'ZX17U-5A', '1.5 - 2.9', true, true, 'CANOPY', 230, 'ESTANDAR'),
  
  -- Rango 3.0 - 3.9 TON
  ('HITACHI', 'ZX30U-3', '3.0 - 3.9', true, true, 'CANOPY', 300, 'ESTANDAR'),
  ('HITACHI', 'ZX30U-5A', '3.0 - 3.9', true, true, 'CANOPY', 300, 'ESTANDAR'),
  ('HITACHI', 'ZX35U-5A', '3.0 - 3.9', true, true, 'CANOPY', 300, 'ESTANDAR'),
  
  -- Rango 4.0 - 5.5 TON
  ('HITACHI', 'ZX40U-5B', '4.0 - 5.5', true, true, 'CANOPY', 400, 'ESTANDAR'),
  ('HITACHI', 'ZX50U-5B', '4.0 - 5.5', true, true, 'CANOPY', 400, 'ESTANDAR'),
  
  -- Rango 7.0 - 8.5 TON
  ('HITACHI', 'ZX75US-5B', '7.0 - 8.5', false, false, 'CABINA CERRADA/AC', 450, 'ESTANDAR'),
  ('HITACHI', 'ZX75USK-5B', '7.0 - 8.5', false, false, 'CABINA CERRADA/AC', 450, 'ESTANDAR'),
  
  -- Rango 10-15 TON (sin ancho de zapatas por defecto - múltiples opciones: 500, 600, 700)
  ('HITACHI', 'ZX120-5B', '10-15', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX120-6', '10-15', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX130L-5B', '10-15', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX130K-6', '10-15', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX135US-5B', '10-15', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX135US-6', '10-15', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX135USK-5B', '10-15', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX135USK-6', '10-15', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  
  -- Rango 20 - 23 TON (sin ancho de zapatas por defecto - múltiples opciones: 600, 800)
  ('HITACHI', 'ZX200-5B', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX200-6', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX200LC-6', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX200X-5B', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX210LC-6', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX210K-5B', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX210K-6', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX210H-6', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX210LCH-5B', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX225US-5B', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX225US-6', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX225USR-5B', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX225USR-6', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX225USRK-5B', '20 - 23', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  
  -- Rango 24 - 26 TON (sin ancho de zapatas por defecto - múltiples opciones: 600, 800)
  ('HITACHI', 'ZX240-6', '24 - 26', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX240LC-6', '24 - 26', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX250K-6', '24 - 26', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  
  -- Rango 28 - 33 TON (sin ancho de zapatas por defecto - múltiples opciones: 600, 800)
  ('HITACHI', 'ZX300LC-6N', '28 - 33', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX300-6A', '28 - 33', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX330-5B', '28 - 33', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX330-6', '28 - 33', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  
  -- Rango 35 - 38 TON (sin ancho de zapatas por defecto - múltiples opciones: 600, 800)
  ('HITACHI', 'ZX350-5B', '35 - 38', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX350H-5B', '35 - 38', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX350H-6', '35 - 38', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX350LC-6N', '35 - 38', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX350K-6', '35 - 38', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX350LCK-6', '35 - 38', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  
  -- Rango 44 - 50 TON (sin ancho de zapatas por defecto - múltiples opciones: 600, 800)
  ('HITACHI', 'ZX490H-6', '44 - 50', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR'),
  ('HITACHI', 'ZX490LCH-5A', '44 - 50', false, false, 'CABINA CERRADA/AC', NULL, 'ESTANDAR')
ON CONFLICT (brand, model) 
DO UPDATE SET
  tonelage = EXCLUDED.tonelage,
  spec_blade = EXCLUDED.spec_blade,
  spec_pip = EXCLUDED.spec_pip,
  spec_cabin = EXCLUDED.spec_cabin,
  shoe_width_mm = EXCLUDED.shoe_width_mm,
  arm_type = EXCLUDED.arm_type,
  updated_at = NOW();
