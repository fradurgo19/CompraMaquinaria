-- Agregar campos de verificación para costos en purchases
-- Estos campos indican si el valor ya es definitivo (verificado por el usuario)

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS inland_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gastos_pto_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flete_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS traslado_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS repuestos_verified BOOLEAN DEFAULT FALSE;

-- Índices para consultas de verificación
CREATE INDEX IF NOT EXISTS idx_purchases_inland_verified ON purchases(inland_verified);
CREATE INDEX IF NOT EXISTS idx_purchases_gastos_pto_verified ON purchases(gastos_pto_verified);
CREATE INDEX IF NOT EXISTS idx_purchases_flete_verified ON purchases(flete_verified);
CREATE INDEX IF NOT EXISTS idx_purchases_traslado_verified ON purchases(traslado_verified);
CREATE INDEX IF NOT EXISTS idx_purchases_repuestos_verified ON purchases(repuestos_verified);

COMMENT ON COLUMN purchases.inland_verified IS 'Indica si el valor de Inland es definitivo';
COMMENT ON COLUMN purchases.gastos_pto_verified IS 'Indica si el valor de Gastos Puerto es definitivo';
COMMENT ON COLUMN purchases.flete_verified IS 'Indica si el valor de Flete es definitivo';
COMMENT ON COLUMN purchases.traslado_verified IS 'Indica si el valor de Traslado es definitivo';
COMMENT ON COLUMN purchases.repuestos_verified IS 'Indica si el valor de PPTO Reparación es definitivo';

