-- Add date and rate fields to purchases table
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS usd_jpy_rate numeric(10,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS trm_rate numeric(10,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_date date;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS shipment_departure_date date;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS shipment_arrival_date date;

COMMENT ON COLUMN purchases.usd_jpy_rate IS 'Tasa de cambio USD/JPY';
COMMENT ON COLUMN purchases.trm_rate IS 'Tasa Representativa del Mercado (TRM)';
COMMENT ON COLUMN purchases.payment_date IS 'Fecha de pago';
COMMENT ON COLUMN purchases.shipment_departure_date IS 'Fecha de embarque salida';
COMMENT ON COLUMN purchases.shipment_arrival_date IS 'Fecha de embarque llegada (calculada +45 días)';

