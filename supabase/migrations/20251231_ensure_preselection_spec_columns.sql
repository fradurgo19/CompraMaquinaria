-- =====================================================
-- Migración: Asegurar que todas las columnas de especificaciones existan en preselections
-- Fecha: 2025-12-31
-- Descripción: Verifica y agrega todas las columnas de especificaciones técnicas necesarias
-- =====================================================

-- Ancho Zapatas (mm)
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS shoe_width_mm NUMERIC;

-- Tipo de Cabina
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_cabin VARCHAR(80);

-- Blade (Hoja Topadora) - BOOLEAN
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_blade BOOLEAN DEFAULT FALSE;

-- Tipo de Brazo
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS arm_type VARCHAR(80);

-- PIP (Accesorios) - BOOLEAN
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_pip BOOLEAN DEFAULT FALSE;

-- PAD - VARCHAR con constraint (Bueno/Malo)
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_pad VARCHAR(10);

-- Actualizar constraint de arm_type si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'preselections_arm_type_check'
  ) THEN
    ALTER TABLE preselections
      ADD CONSTRAINT preselections_arm_type_check 
      CHECK (arm_type IS NULL OR arm_type IN ('ESTANDAR', 'N/A', 'LONG ARM'));
  END IF;
END $$;

-- Actualizar constraint de spec_pad si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'preselections_spec_pad_check'
  ) THEN
    ALTER TABLE preselections
      DROP CONSTRAINT IF EXISTS preselections_spec_pad_check;
    ALTER TABLE preselections
      ADD CONSTRAINT preselections_spec_pad_check 
      CHECK (spec_pad IS NULL OR spec_pad IN ('Bueno', 'Malo'));
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN preselections.shoe_width_mm IS 'Ancho de zapatas en mm';
COMMENT ON COLUMN preselections.spec_cabin IS 'Tipo de cabina';
COMMENT ON COLUMN preselections.spec_blade IS 'Blade (Hoja Topadora): TRUE/FALSE';
COMMENT ON COLUMN preselections.arm_type IS 'Tipo de brazo: ESTANDAR, N/A o LONG ARM';
COMMENT ON COLUMN preselections.spec_pip IS 'PIP (Accesorios): TRUE/FALSE';
COMMENT ON COLUMN preselections.spec_pad IS 'Estado del PAD: Bueno o Malo';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
