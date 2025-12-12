-- Migration: Fix cost_items - rename concept to type
-- Fecha: 2025-12-07
-- Descripción: Renombrar columna concept a type según migración original

-- Verificar si existe la columna concept y renombrarla a type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cost_items' AND column_name = 'concept'
  ) THEN
    ALTER TABLE cost_items RENAME COLUMN concept TO type;
  END IF;
END $$;

-- Actualizar constraint con tipos específicos
ALTER TABLE cost_items 
  DROP CONSTRAINT IF EXISTS cost_items_type_check;

ALTER TABLE cost_items 
  ADD CONSTRAINT cost_items_type_check 
  CHECK (type IN ('INLAND', 'GASTOS_PTO', 'FLETE', 'TRASLD', 'REPUESTOS', 'MANT_EJEC'));

