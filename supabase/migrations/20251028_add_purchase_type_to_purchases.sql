-- Agregar columna purchase_type a la tabla purchases

-- 1. Agregar la columna
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS purchase_type TEXT;

-- 2. Crear índice para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_type ON purchases(purchase_type);

-- 3. Comentario para documentación
COMMENT ON COLUMN purchases.purchase_type IS 'Tipo de compra: SUBASTA o STOCK';

