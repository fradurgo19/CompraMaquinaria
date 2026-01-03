-- Asegurar que la columna description existe en new_purchases
-- Esta migración es idempotente y puede ejecutarse múltiples veces de forma segura

ALTER TABLE new_purchases 
ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN new_purchases.description IS 'Descripción de la compra que se muestra en el PDF de orden de compra';
