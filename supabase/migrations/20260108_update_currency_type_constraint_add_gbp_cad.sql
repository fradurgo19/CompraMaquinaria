-- Migration: Update currency_type constraint to include GBP and CAD
-- Created: 2026-01-08
-- Description: Add GBP and CAD to the currency_type CHECK constraint to match frontend validation
--              This ensures the constraint allows all currencies validated in the application

-- Drop existing constraint if it exists
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_currency_type_check;

-- Add new constraint with all valid currency types
ALTER TABLE purchases ADD CONSTRAINT purchases_currency_type_check 
  CHECK (currency_type IN ('JPY', 'USD', 'EUR', 'GBP', 'CAD'));

-- Update comment to reflect all allowed values
COMMENT ON COLUMN purchases.currency_type IS 'Tipo de moneda: JPY, USD, EUR, GBP, CAD';
