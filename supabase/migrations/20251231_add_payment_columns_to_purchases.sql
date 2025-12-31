-- Agregar todas las columnas de pagos faltantes en purchases
-- Estas columnas son necesarias para el módulo de pagos

-- ====================
-- COLUMNAS DE PAGO 1
-- ====================

-- pago1_contravalor: Contravalor del primer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago1_contravalor NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.purchases.pago1_contravalor IS 'Contravalor del primer pago';

-- pago1_trm: TRM del primer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago1_trm NUMERIC(10,2);

COMMENT ON COLUMN public.purchases.pago1_trm IS 'TRM del primer pago';

-- pago1_valor_girado: Valor girado del primer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago1_valor_girado NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.purchases.pago1_valor_girado IS 'Valor girado del primer pago';

-- pago1_tasa: Tasa del primer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago1_tasa NUMERIC(10,4);

COMMENT ON COLUMN public.purchases.pago1_tasa IS 'Tasa del primer pago';

-- ====================
-- COLUMNAS DE PAGO 2
-- ====================

-- pago2_contravalor: Contravalor del segundo pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago2_contravalor NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.purchases.pago2_contravalor IS 'Contravalor del segundo pago';

-- pago2_trm: TRM del segundo pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago2_trm NUMERIC(10,2);

COMMENT ON COLUMN public.purchases.pago2_trm IS 'TRM del segundo pago';

-- pago2_valor_girado: Valor girado del segundo pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago2_valor_girado NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.purchases.pago2_valor_girado IS 'Valor girado del segundo pago';

-- pago2_tasa: Tasa del segundo pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago2_tasa NUMERIC(10,4);

COMMENT ON COLUMN public.purchases.pago2_tasa IS 'Tasa del segundo pago';

-- ====================
-- COLUMNAS DE PAGO 3
-- ====================

-- pago3_contravalor: Contravalor del tercer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago3_contravalor NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.purchases.pago3_contravalor IS 'Contravalor del tercer pago';

-- pago3_trm: TRM del tercer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago3_trm NUMERIC(10,2);

COMMENT ON COLUMN public.purchases.pago3_trm IS 'TRM del tercer pago';

-- pago3_valor_girado: Valor girado del tercer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago3_valor_girado NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.purchases.pago3_valor_girado IS 'Valor girado del tercer pago';

-- pago3_tasa: Tasa del tercer pago
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pago3_tasa NUMERIC(10,4);

COMMENT ON COLUMN public.purchases.pago3_tasa IS 'Tasa del tercer pago';

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_purchases_pago1_valor_girado ON public.purchases(pago1_valor_girado);
CREATE INDEX IF NOT EXISTS idx_purchases_pago2_valor_girado ON public.purchases(pago2_valor_girado);
CREATE INDEX IF NOT EXISTS idx_purchases_pago3_valor_girado ON public.purchases(pago3_valor_girado);
