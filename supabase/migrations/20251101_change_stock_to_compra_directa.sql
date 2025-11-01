-- Cambiar 'STOCK' a 'COMPRA_DIRECTA' en todo el sistema
-- Fecha: 2025-11-01

-- 1. Actualizar todos los registros existentes en la tabla auctions
UPDATE auctions 
SET purchase_type = 'COMPRA_DIRECTA' 
WHERE purchase_type = 'STOCK';

-- 2. Actualizar todos los registros existentes en la tabla purchases (si tiene la columna)
UPDATE purchases 
SET purchase_type = 'COMPRA_DIRECTA' 
WHERE purchase_type = 'STOCK';

-- 3. Actualizar todos los registros existentes en la tabla management_table
UPDATE management_table 
SET tipo_compra = 'COMPRA_DIRECTA' 
WHERE tipo_compra = 'STOCK';

-- 4. Eliminar el constraint anterior y crear uno nuevo
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_purchase_type_check;
ALTER TABLE auctions ADD CONSTRAINT auctions_purchase_type_check 
  CHECK (purchase_type IN ('SUBASTA', 'COMPRA_DIRECTA'));

-- 5. Agregar comentario explicativo
COMMENT ON COLUMN auctions.purchase_type IS 'Tipo de compra: SUBASTA o COMPRA_DIRECTA (antes STOCK)';

