-- Agregar columna total_valor_girado a new_purchases
-- Esta columna es necesaria para el módulo de pagos cuando se consultan new_purchases

ALTER TABLE public.new_purchases 
ADD COLUMN IF NOT EXISTS total_valor_girado NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.new_purchases.total_valor_girado IS 'Total del valor girado (suma de pago1_valor_girado + pago2_valor_girado + pago3_valor_girado)';

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_new_purchases_total_valor_girado ON public.new_purchases(total_valor_girado);
