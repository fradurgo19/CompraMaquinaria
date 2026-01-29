-- Agregar columna Fecha a cada pago (pago1, pago2, pago3) después de Moneda.
-- Cada pago tendrá su propia fecha (pago1_fecha, pago2_fecha, pago3_fecha).

-- ====================
-- PURCHASES
-- ====================
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS pago1_fecha DATE;

ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS pago2_fecha DATE;

ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS pago3_fecha DATE;

COMMENT ON COLUMN public.purchases.pago1_fecha IS 'Fecha del Pago 1';
COMMENT ON COLUMN public.purchases.pago2_fecha IS 'Fecha del Pago 2';
COMMENT ON COLUMN public.purchases.pago3_fecha IS 'Fecha del Pago 3';

-- ====================
-- NEW_PURCHASES
-- ====================
ALTER TABLE public.new_purchases
ADD COLUMN IF NOT EXISTS pago1_fecha DATE;

ALTER TABLE public.new_purchases
ADD COLUMN IF NOT EXISTS pago2_fecha DATE;

ALTER TABLE public.new_purchases
ADD COLUMN IF NOT EXISTS pago3_fecha DATE;

COMMENT ON COLUMN public.new_purchases.pago1_fecha IS 'Fecha del Pago 1';
COMMENT ON COLUMN public.new_purchases.pago2_fecha IS 'Fecha del Pago 2';
COMMENT ON COLUMN public.new_purchases.pago3_fecha IS 'Fecha del Pago 3';
