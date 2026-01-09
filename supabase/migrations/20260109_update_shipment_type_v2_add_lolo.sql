-- Migration: Update shipment_type_v2 constraint to include LOLO
-- Created: 2026-01-09
-- Description: Add LOLO to the shipment_type_v2 CHECK constraint to match frontend validation

-- Drop existing constraint if it exists
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_shipment_type_v2_check;

-- Add new constraint with all valid shipment types including LOLO
ALTER TABLE purchases ADD CONSTRAINT purchases_shipment_type_v2_check
  CHECK (shipment_type_v2 IS NULL OR shipment_type_v2 IN ('1X40', 'RORO', 'LOLO'));

-- Update comment to reflect all allowed values
COMMENT ON COLUMN purchases.shipment_type_v2 IS 'Tipo de envío: 1X40, RORO, LOLO';
