-- Migration: Add 1X20 to purchases shipment type constraint
-- Description: Allows 1X20 in purchases.shipment_type_v2 for Purchases and Management modules.

ALTER TABLE purchases
DROP CONSTRAINT IF EXISTS purchases_shipment_type_v2_check;

ALTER TABLE purchases
ADD CONSTRAINT purchases_shipment_type_v2_check
CHECK (shipment_type_v2 IS NULL OR shipment_type_v2 IN ('1X40', '1X20', 'RORO', 'LOLO'));

COMMENT ON COLUMN purchases.shipment_type_v2 IS 'Tipo de envio: 1X40, 1X20, RORO, LOLO';
