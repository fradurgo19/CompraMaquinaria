-- =====================================================
-- MIGRACIÓN: Agregar columnas financieras a new_purchases
-- =====================================================
-- Esta migración agrega las columnas para:
-- - FECHA VENCIMIENTO (due_date)
-- - FLETES (shipping_costs)
-- - FINANCE (finance_costs)
-- - VALOR TOTAL se calcula automáticamente (value + shipping_costs + finance_costs)
-- =====================================================

-- Agregar columna FECHA VENCIMIENTO
ALTER TABLE new_purchases
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Agregar columna FLETES
ALTER TABLE new_purchases
  ADD COLUMN IF NOT EXISTS shipping_costs NUMERIC(15, 2) DEFAULT 0;

-- Agregar columna FINANCE
ALTER TABLE new_purchases
  ADD COLUMN IF NOT EXISTS finance_costs NUMERIC(15, 2) DEFAULT 0;

-- Comentarios
COMMENT ON COLUMN new_purchases.due_date IS 'Fecha de vencimiento de la factura';
COMMENT ON COLUMN new_purchases.shipping_costs IS 'Costos de fletes';
COMMENT ON COLUMN new_purchases.finance_costs IS 'Costos financieros';
COMMENT ON COLUMN new_purchases.value IS 'Valor base de la compra';

