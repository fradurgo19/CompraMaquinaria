-- Migration: Add multiple payment fields (up to 3 payments) to purchases table
-- Date: 2025-01-18
-- Description: Add fields for PAGO 1, PAGO 2, PAGO 3 with moneda, contravalor, trm, valor_girado
--              Tasa is calculated as TRM / Contravalor

-- ====================
-- ADD PAYMENT 1 FIELDS
-- ====================

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago1_moneda text CHECK (pago1_moneda IN ('JPY', 'USD', 'EUR', 'GBP'));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago1_contravalor numeric(15,4);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago1_trm numeric(15,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago1_valor_girado numeric(15,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago1_tasa numeric(15,4);

-- ====================
-- ADD PAYMENT 2 FIELDS
-- ====================

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago2_moneda text CHECK (pago2_moneda IN ('JPY', 'USD', 'EUR', 'GBP'));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago2_contravalor numeric(15,4);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago2_trm numeric(15,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago2_valor_girado numeric(15,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago2_tasa numeric(15,4);

-- ====================
-- ADD PAYMENT 3 FIELDS
-- ====================

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago3_moneda text CHECK (pago3_moneda IN ('JPY', 'USD', 'EUR', 'GBP'));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago3_contravalor numeric(15,4);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago3_trm numeric(15,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago3_valor_girado numeric(15,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pago3_tasa numeric(15,4);

-- ====================
-- COMMENTS
-- ====================

COMMENT ON COLUMN purchases.pago1_moneda IS 'Moneda del Pago 1: JPY, USD, EUR, GBP';
COMMENT ON COLUMN purchases.pago1_contravalor IS 'Contravalor (USD/JPY rate) del Pago 1';
COMMENT ON COLUMN purchases.pago1_trm IS 'TRM (Tasa Representativa del Mercado) del Pago 1';
COMMENT ON COLUMN purchases.pago1_valor_girado IS 'Valor Girado del Pago 1';
COMMENT ON COLUMN purchases.pago1_tasa IS 'Tasa calculada del Pago 1 (TRM / Contravalor)';

COMMENT ON COLUMN purchases.pago2_moneda IS 'Moneda del Pago 2: JPY, USD, EUR, GBP';
COMMENT ON COLUMN purchases.pago2_contravalor IS 'Contravalor (USD/JPY rate) del Pago 2';
COMMENT ON COLUMN purchases.pago2_trm IS 'TRM (Tasa Representativa del Mercado) del Pago 2';
COMMENT ON COLUMN purchases.pago2_valor_girado IS 'Valor Girado del Pago 2';
COMMENT ON COLUMN purchases.pago2_tasa IS 'Tasa calculada del Pago 2 (TRM / Contravalor)';

COMMENT ON COLUMN purchases.pago3_moneda IS 'Moneda del Pago 3: JPY, USD, EUR, GBP';
COMMENT ON COLUMN purchases.pago3_contravalor IS 'Contravalor (USD/JPY rate) del Pago 3';
COMMENT ON COLUMN purchases.pago3_trm IS 'TRM (Tasa Representativa del Mercado) del Pago 3';
COMMENT ON COLUMN purchases.pago3_valor_girado IS 'Valor Girado del Pago 3';
COMMENT ON COLUMN purchases.pago3_tasa IS 'Tasa calculada del Pago 3 (TRM / Contravalor)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
