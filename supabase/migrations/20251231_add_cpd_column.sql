-- Agregar columna cpd a purchases
-- Esta columna es necesaria para el funcionamiento correcto de las páginas

-- cpd: Campo CPD (necesario para el módulo de compras)
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS cpd TEXT;

COMMENT ON COLUMN public.purchases.cpd IS 'Campo CPD (módulo de compras)';

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_purchases_cpd ON public.purchases(cpd);
