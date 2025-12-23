-- Migration: Rename EP column to EPA in auctions and purchases (with existence check)
-- Date: 2025-01-18
-- Description: Rename EP (Entrada Provisional) column to EPA in auctions and purchases tables
--              This version checks if ep exists before renaming

-- ====================
-- 1. RENAME EP TO EPA IN AUCTIONS
-- ====================

-- Renombrar columna ep a epa en auctions (solo si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auctions' 
    AND column_name = 'ep'
  ) THEN
    ALTER TABLE auctions RENAME COLUMN ep TO epa;
    RAISE NOTICE 'Columna ep renombrada a epa en auctions';
  ELSE
    RAISE NOTICE 'Columna ep no existe en auctions, se omite el renombrado';
  END IF;
END $$;

-- Comentario actualizado
COMMENT ON COLUMN auctions.epa IS 'Entrada Provisional Aduanera: SI o NO';

-- ====================
-- 2. RENAME EP TO EPA IN PURCHASES
-- ====================

-- Renombrar columna ep a epa en purchases (solo si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchases' 
    AND column_name = 'ep'
  ) THEN
    ALTER TABLE purchases RENAME COLUMN ep TO epa;
    RAISE NOTICE 'Columna ep renombrada a epa en purchases';
  ELSE
    RAISE NOTICE 'Columna ep no existe en purchases, se omite el renombrado';
  END IF;
END $$;

-- Comentario actualizado
COMMENT ON COLUMN purchases.epa IS 'Entrada Provisional Aduanera: SI o NO (sincronizado desde auctions)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

