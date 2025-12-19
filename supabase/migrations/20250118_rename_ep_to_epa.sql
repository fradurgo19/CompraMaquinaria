-- Migration: Rename EP column to EPA in auctions and purchases
-- Date: 2025-01-18
-- Description: Rename EP (Entrada Provisional) column to EPA in auctions and purchases tables

-- ====================
-- 1. RENAME EP TO EPA IN AUCTIONS
-- ====================

-- Renombrar columna ep a epa en auctions
ALTER TABLE auctions
  RENAME COLUMN ep TO epa;

-- Comentario actualizado
COMMENT ON COLUMN auctions.epa IS 'Entrada Provisional Aduanera: SI o NO';

-- ====================
-- 2. RENAME EP TO EPA IN PURCHASES
-- ====================

-- Renombrar columna ep a epa en purchases
ALTER TABLE purchases
  RENAME COLUMN ep TO epa;

-- Comentario actualizado
COMMENT ON COLUMN purchases.epa IS 'Entrada Provisional Aduanera: SI o NO (sincronizado desde auctions)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
