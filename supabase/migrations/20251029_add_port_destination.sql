-- Agregar columna port_of_destination a purchases
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS port_of_destination TEXT;

COMMENT ON COLUMN purchases.port_of_destination IS 'Puerto de destino: BUENAVENTURA, CARTAGENA o SANTA MARTA';

