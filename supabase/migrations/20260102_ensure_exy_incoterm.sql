-- Migration: Ensure EXY incoterm is allowed for purchases
-- Created: 2026-01-02
-- Description: Update incoterm constraint to allow EXY (required for auctions)

-- Drop old constraint if it exists
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_incoterm_check;

-- Add new constraint that allows FOB, EXY, and CIF
ALTER TABLE purchases ADD CONSTRAINT purchases_incoterm_check 
  CHECK (incoterm IN ('FOB', 'EXY', 'CIF'));

-- Update any existing EXW values to FOB (EXW is no longer allowed)
UPDATE purchases SET incoterm = 'FOB' WHERE incoterm = 'EXW';

-- Comment
COMMENT ON COLUMN purchases.incoterm IS 'Incoterm: FOB, EXY (default for auctions, can be modified by purchases user), or CIF';
