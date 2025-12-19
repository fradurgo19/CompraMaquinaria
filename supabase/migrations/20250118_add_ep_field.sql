-- Migration: Add EP field to auctions and purchases
-- Date: 2025-01-18
-- Description: Add EP (Entrada Provisional) field to auctions table and purchases table
--              EP is a boolean-like field with values 'SI' or 'NO'

-- ====================
-- 1. ADD EP TO AUCTIONS
-- ====================

-- Agregar columna ep a auctions
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS ep text CHECK (ep IN ('SI', 'NO'));

-- Comentario
COMMENT ON COLUMN auctions.ep IS 'Entrada Provisional: SI o NO';

-- ====================
-- 2. ADD EP TO PURCHASES
-- ====================

-- Agregar columna ep a purchases
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS ep text CHECK (ep IN ('SI', 'NO'));

-- Comentario
COMMENT ON COLUMN purchases.ep IS 'Entrada Provisional: SI o NO (sincronizado desde auctions)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
