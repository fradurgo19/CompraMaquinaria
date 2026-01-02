-- Migration: Update CPD field to VERDE/ROJA and update currency constraints
-- Created: 2025-01-17
-- Description: 
-- 1. Update CPD field to accept only 'VERDE' or 'ROJA'
-- 2. Update currency_type to include GBP and remove COP
-- 3. Update incoterm constraint to remove EXW

-- Update CPD constraint
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_cpd_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_cpd_check 
  CHECK (cpd IS NULL OR cpd IN ('VERDE', 'ROJA', 'X'));

-- Update currency_type constraint to include GBP and remove COP
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_currency_type_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_currency_type_check 
  CHECK (currency_type IN ('JPY', 'USD', 'EUR', 'GBP'));

-- Update default value for currency_type if needed (only if column doesn't have a default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchases' 
    AND column_name = 'currency_type' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE purchases ALTER COLUMN currency_type SET DEFAULT 'JPY';
  END IF;
END $$;

-- Update incoterm constraint to remove EXW (keep only FOB, EXY, CIF)
-- First, update any EXW values to FOB (or handle as needed)
UPDATE purchases SET incoterm = 'FOB' WHERE incoterm = 'EXW';

-- Drop old constraint
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_incoterm_check;

-- Add new constraint
ALTER TABLE purchases ADD CONSTRAINT purchases_incoterm_check 
  CHECK (incoterm IN ('FOB', 'EXY', 'CIF'));

-- Update any existing 'X' values to 'ROJA' for consistency
UPDATE purchases SET cpd = 'ROJA' WHERE cpd = 'X' OR cpd = 'x';

-- Comments
COMMENT ON COLUMN purchases.cpd IS 'CPD: VERDE (checked) or ROJA/X (unchecked)';
COMMENT ON COLUMN purchases.currency_type IS 'Tipo de moneda: JPY, USD, EUR, GBP';
COMMENT ON COLUMN purchases.incoterm IS 'Incoterm: FOB, EXY, o CIF';
