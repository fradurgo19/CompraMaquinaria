-- Migration: Add total_valor_girado field to purchases table
-- Date: 2025-01-18
-- Description: Add total_valor_girado field to store the sum of all payment values (valor_girado)
--              This value is synchronized from pagos module for each specific record (by ID)
--              Each machine has independent payments even if they share the same MQ
--              NOTE: Currently only synchronized in purchases, NOT in new_purchases

-- ====================
-- ADD TOTAL_VALOR_GIRADO FIELD TO PURCHASES
-- ====================

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_valor_girado numeric(15,2);

-- Comment
COMMENT ON COLUMN purchases.total_valor_girado IS 'Total Valor Girado: Suma de pago1_valor_girado + pago2_valor_girado + pago3_valor_girado (sincronizado desde pagos para cada registro específico)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
