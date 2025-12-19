-- Migration: Update currency constraint to include GBP
-- Date: 2025-01-18
-- Description: Update currency CHECK constraint to include GBP and remove COP
--              to match currency_type constraint

-- ====================
-- UPDATE CURRENCY CONSTRAINT
-- ====================

-- Update currency constraint to include GBP and remove COP
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_currency_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_currency_check
  CHECK (currency IN ('JPY', 'USD', 'EUR', 'GBP'));

-- Update any existing COP values to USD (or another default)
-- Since COP is being removed, convert existing COP to USD
UPDATE purchases SET currency = 'USD' WHERE currency = 'COP';

-- Comments
COMMENT ON COLUMN purchases.currency IS 'Tipo de moneda: JPY, USD, EUR, GBP (sincronizado con currency_type)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
