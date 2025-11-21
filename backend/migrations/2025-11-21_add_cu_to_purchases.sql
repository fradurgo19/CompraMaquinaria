-- Agregar columna CU (Consecutivo Único) a purchases para agrupar compras
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS cu VARCHAR(50);

-- Crear índice para búsquedas por CU
CREATE INDEX IF NOT EXISTS idx_purchases_cu ON purchases(cu);

-- Comentario
COMMENT ON COLUMN purchases.cu IS 'Consecutivo Único para agrupar múltiples compras en un solo CU';

