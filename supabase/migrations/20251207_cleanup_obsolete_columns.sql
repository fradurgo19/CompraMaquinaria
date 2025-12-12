-- Migration: Cleanup obsolete columns and ensure consistency
-- Fecha: 2025-12-07
-- Descripción: Identificar y documentar columnas obsoletas que pueden eliminarse después de migración

-- NOTA: Esta migración NO elimina columnas automáticamente
-- Solo documenta cuáles son obsoletas para revisión manual después de migrar

-- Columnas obsoletas identificadas en purchases:
-- - cpd: Columna que parece no usarse más (verificar antes de eliminar)
-- - total_fob_old, total_cif_old, etc. en management_table: Se renombraron pero pueden eliminarse después

-- Verificar si existen columnas _old en management_table (se crean en migración 20251015230000)
DO $$
BEGIN
  -- Solo crear comentarios sobre columnas obsoletas, no eliminarlas aún
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'total_fob_old') THEN
    COMMENT ON COLUMN management_table.total_fob_old IS 'OBSOLETA: Renombrada a precio_fob. Eliminar después de confirmar migración.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'total_cif_old') THEN
    COMMENT ON COLUMN management_table.total_cif_old IS 'OBSOLETA: Renombrada a cif_usd/cif_local. Eliminar después de confirmar migración.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'total_costs_old') THEN
    COMMENT ON COLUMN management_table.total_costs_old IS 'OBSOLETA: Reemplazada por columnas individuales (inland, gastos_pto, etc.). Eliminar después de confirmar migración.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'projected_value_old') THEN
    COMMENT ON COLUMN management_table.projected_value_old IS 'OBSOLETA: Renombrada a proyectado. Eliminar después de confirmar migración.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'estimated_pvp_old') THEN
    COMMENT ON COLUMN management_table.estimated_pvp_old IS 'OBSOLETA: Renombrada a pvp_est. Eliminar después de confirmar migración.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'final_comments_old') THEN
    COMMENT ON COLUMN management_table.final_comments_old IS 'OBSOLETA: Renombrada a comentarios_pc. Eliminar después de confirmar migración.';
  END IF;
END $$;

-- Verificar columna cpd en purchases (verificar si realmente está obsoleta)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'cpd') THEN
    COMMENT ON COLUMN purchases.cpd IS 'VERIFICAR: Parece obsoleta. Revisar uso antes de eliminar en producción.';
  END IF;
END $$;

