-- Migration: Update existing total_valor_girado values in purchases table
-- Date: 2025-01-18
-- Description: Calculate and update total_valor_girado for existing records based on pago1/2/3_valor_girado
--              This ensures existing data has the correct total_valor_girado values

-- ====================
-- UPDATE EXISTING TOTAL_VALOR_GIRADO IN PURCHASES
-- ====================

UPDATE purchases 
SET total_valor_girado = COALESCE(pago1_valor_girado, 0) + 
                         COALESCE(pago2_valor_girado, 0) + 
                         COALESCE(pago3_valor_girado, 0),
    updated_at = NOW()
WHERE total_valor_girado IS NULL 
   OR total_valor_girado != (COALESCE(pago1_valor_girado, 0) + 
                             COALESCE(pago2_valor_girado, 0) + 
                             COALESCE(pago3_valor_girado, 0));

-- ====================
-- NOTA SOBRE NEW_PURCHASES
-- ====================

-- NOTA: new_purchases NO se actualiza en este momento
-- El total_valor_girado solo se sincroniza en purchases (compras)
-- Los compras nuevos (new-purchases) no reciben este valor aún

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
