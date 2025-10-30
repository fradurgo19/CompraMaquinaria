-- Agregar columna de precio de venta real al módulo de equipos
ALTER TABLE equipments
ADD COLUMN IF NOT EXISTS real_sale_price NUMERIC;

COMMENT ON COLUMN equipments.real_sale_price IS 'Precio de venta real definido por jefe_comercial';


