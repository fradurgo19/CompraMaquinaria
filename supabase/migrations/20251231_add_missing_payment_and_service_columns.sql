-- Agregar columnas faltantes en purchases y service_records
-- Estas columnas son necesarias para el funcionamiento correcto de las páginas

-- ====================
-- COLUMNAS EN PURCHASES
-- ====================

-- total_valor_girado: Total del valor girado (suma de pago1, pago2, pago3)
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS total_valor_girado NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.purchases.total_valor_girado IS 'Total del valor girado (suma de pago1_valor_girado + pago2_valor_girado + pago3_valor_girado)';

-- Campos de múltiples pagos (monedas)
-- pago1_moneda: Moneda del primer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago1_moneda TEXT 
CHECK (pago1_moneda IS NULL OR pago1_moneda IN ('USD', 'JPY', 'EUR', 'COP'));

COMMENT ON COLUMN public.purchases.pago1_moneda IS 'Moneda del primer pago';

-- pago2_moneda: Moneda del segundo pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago2_moneda TEXT 
CHECK (pago2_moneda IS NULL OR pago2_moneda IN ('USD', 'JPY', 'EUR', 'COP'));

COMMENT ON COLUMN public.purchases.pago2_moneda IS 'Moneda del segundo pago';

-- pago3_moneda: Moneda del tercer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago3_moneda TEXT 
CHECK (pago3_moneda IS NULL OR pago3_moneda IN ('USD', 'JPY', 'EUR', 'COP'));

COMMENT ON COLUMN public.purchases.pago3_moneda IS 'Moneda del tercer pago';

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_purchases_total_valor_girado ON public.purchases(total_valor_girado);
CREATE INDEX IF NOT EXISTS idx_purchases_pago1_moneda ON public.purchases(pago1_moneda);
CREATE INDEX IF NOT EXISTS idx_purchases_pago2_moneda ON public.purchases(pago2_moneda);
CREATE INDEX IF NOT EXISTS idx_purchases_pago3_moneda ON public.purchases(pago3_moneda);

-- ====================
-- COLUMNAS EN SERVICE_RECORDS
-- ====================

-- comentarios: Comentarios del módulo de servicio
ALTER TABLE public.service_records 
ADD COLUMN IF NOT EXISTS comentarios TEXT;

COMMENT ON COLUMN public.service_records.comentarios IS 'Comentarios del módulo de servicio';

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_service_records_comentarios ON public.service_records(comentarios);
