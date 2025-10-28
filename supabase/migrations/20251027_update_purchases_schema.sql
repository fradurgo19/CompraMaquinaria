-- Migration: Update purchases table with new columns for purchase management
-- Created: 2025-10-27
-- Description: Add all columns required for purchase tracking by Eliana

-- Add new columns to purchases table
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS mq text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS shipment_type_v2 text CHECK (shipment_type_v2 IN ('1X40', 'RORO'));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_name text; -- Store as text instead of FK
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS serial text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS location text CHECK (location IN (
  'KOBE', 'YOKOHAMA', 'NARITA', 'HAKATA', 'FUJI', 'TOMAKOMAI', 'SAKURA',
  'LEBANON', 'LAKE WORTH', 'NAGOYA', 'HOKKAIDO', 'OSAKA', 'ALBERTA',
  'FLORIDA', 'KASHIBA', 'HYOGO', 'MIAMI'
));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency_type text CHECK (currency_type IN ('JPY', 'USD', 'EUR')) DEFAULT 'JPY';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS port_of_embarkation text CHECK (port_of_embarkation IN (
  'KOBE', 'YOKOHAMA', 'SAVANNA', 'JACKSONVILLE', 'CANADA', 'MIAMI'
));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS exw_value_formatted text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS fob_expenses text; -- Gastos FOB + Lavado
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS disassembly_load_value numeric(15,2); -- Desensamblaje + Cargue
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS fob_total numeric(15,2); -- Suma automática
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS usd_jpy_rate_display text; -- Display como "PDTE" en rojo
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS trm_display text; -- Display como "PDTE" en rojo
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_date_display text; -- Display como "PDTE" en rojo
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS shipment_departure_display text; -- Display como "PDTE" en rojo
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS estimated_arrival_display text; -- Calculado automático +45 días
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS sales_reported text DEFAULT 'PDTE' CHECK (sales_reported IN ('OK', 'PDTE'));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS commerce_reported text DEFAULT 'PDTE' CHECK (commerce_reported IN ('OK', 'PDTE'));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS luis_lemus_reported text DEFAULT 'PDTE' CHECK (luis_lemus_reported IN ('OK', 'PDTE'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_name ON purchases(supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchases_model ON purchases(model);
CREATE INDEX IF NOT EXISTS idx_purchases_serial ON purchases(serial);
CREATE INDEX IF NOT EXISTS idx_purchases_location ON purchases(location);

-- Comments
COMMENT ON COLUMN purchases.mq IS 'Identificador de máquina (MQ) - texto manual';
COMMENT ON COLUMN purchases.shipment_type_v2 IS 'Tipo de envío: 1X40 o RORO';
COMMENT ON COLUMN purchases.supplier_name IS 'Nombre del proveedor (tipo texto)';
COMMENT ON COLUMN purchases.model IS 'Modelo de máquina (traído de auctions)';
COMMENT ON COLUMN purchases.serial IS 'Serial de máquina (traído de auctions)';
COMMENT ON COLUMN purchases.location IS 'Ubicación de la máquina';
COMMENT ON COLUMN purchases.currency_type IS 'Tipo de moneda: JPY, USD, EUR';
COMMENT ON COLUMN purchases.port_of_embarkation IS 'Puerto de embarque';
COMMENT ON COLUMN purchases.exw_value_formatted IS 'Valor EXW + Buyer Premium formateado';
COMMENT ON COLUMN purchases.fob_expenses IS 'Gastos FOB + Lavado (texto descriptivo)';
COMMENT ON COLUMN purchases.sales_reported IS 'Estado de reporte a ventas: OK o PDTE';
COMMENT ON COLUMN purchases.commerce_reported IS 'Estado de reporte a comercio: OK o PDTE';
COMMENT ON COLUMN purchases.luis_lemus_reported IS 'Estado de reporte a Luis Lemus: OK o PDTE';

