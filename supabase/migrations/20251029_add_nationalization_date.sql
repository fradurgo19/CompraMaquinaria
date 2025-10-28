-- Agregar columna de fecha de nacionalización a purchases
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS nationalization_date DATE;

COMMENT ON COLUMN purchases.nationalization_date IS 'Fecha de nacionalización (solo para módulo de importaciones)';

