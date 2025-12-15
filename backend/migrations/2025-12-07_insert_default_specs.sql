-- Migration: Insert default machine specifications
-- Run manually: psql -U postgres -d maquinaria_usada -f backend/migrations/2025-12-07_insert_default_specs.sql

-- Insertar especificaciones por defecto de máquinas
-- Usar ON CONFLICT para actualizar si ya existen

INSERT INTO machine_spec_defaults (brand, model, capacidad, spec_blade, spec_pip, spec_cabin, shoe_width_mm, arm_type)
VALUES
  ('YANMAR', 'VIO17-1B', 'MINIS', true, true, 'CANOPY', 230, 'ESTANDAR'),
  ('HITACHI', 'ZX17U-5A', 'MINIS', true, true, 'CANOPY', 230, 'ESTANDAR'),
  ('HITACHI', 'ZX30U-5A', 'MINIS', true, true, 'CANOPY', 300, 'ESTANDAR'),
  ('YANMAR', 'VIO35-7', 'MINIS', true, true, 'CANOPY', 300, 'ESTANDAR'),
  ('HITACHI', 'ZX40U-5B', 'MINIS', true, true, 'CANOPY', 350, 'ESTANDAR'),
  ('YANMAR', 'VIO50-7', 'MINIS', true, true, 'CABINA CERRADA', 400, 'ESTANDAR'),
  ('AIRMAN', 'AX50-3', 'MINIS', true, true, 'CANOPY', 400, 'ESTANDAR'),
  ('HITACHI', 'ZX75US-5B', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 450, 'ESTANDAR'),
  ('HITACHI', 'ZX75USK-5B', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 450, 'ESTANDAR'),
  ('HITACHI', 'ZX75-7', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 450, 'ESTANDAR'),
  ('YANMAR', 'VIO80-7', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 450, 'ESTANDAR'),
  ('LIUGONG', '909F', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 450, 'ESTANDAR'),
  ('HITACHI', 'ZX120-6', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 600, 'ESTANDAR'),
  ('HITACHI', 'ZX135US-6', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 500, 'ESTANDAR'),
  ('HITACHI', 'ZX135USK-5B', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 500, 'ESTANDAR'),
  ('HITACHI', 'ZX135US-5B', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 500, 'ESTANDAR'),
  ('HITACHI', 'ZX130-5B', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 700, 'ESTANDAR'),
  ('LIUGONG', '915F', 'MEDIANAS', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 600, 'ESTANDAR'),
  ('LIUGONG', '920F', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 800, 'ESTANDAR'),
  ('LIUGONG', '922F', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 800, 'ESTANDAR'),
  ('HITACHI', 'ZX200-6', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 600, 'ESTANDAR'),
  ('HITACHI', 'ZX200LC-5B', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 700, 'ESTANDAR'),
  ('HITACHI', 'ZX225USR-6', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 600, 'ESTANDAR'),
  ('HITACHI', 'ZX210LC-5B', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 800, 'ESTANDAR'),
  ('HITACHI', 'ZX350LC-6N', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 800, 'ESTANDAR'),
  ('HITACHI', 'ZX350H-5B', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 800, 'ESTANDAR'),
  ('HITACHI', 'ZX350LC-5B', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 800, 'ESTANDAR'),
  ('LIUGONG', '933F', 'GRANDES', false, false, 'CABINA CERRADA / AIRE ACONDICIONADO', 800, 'ESTANDAR')
ON CONFLICT (brand, model) 
DO UPDATE SET
  capacidad = EXCLUDED.capacidad,
  spec_blade = EXCLUDED.spec_blade,
  spec_pip = EXCLUDED.spec_pip,
  spec_cabin = EXCLUDED.spec_cabin,
  shoe_width_mm = EXCLUDED.shoe_width_mm,
  arm_type = EXCLUDED.arm_type,
  updated_at = NOW();

