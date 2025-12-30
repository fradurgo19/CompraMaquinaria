-- Agregar columna epa (Entrada Provisional Aduanera) a auctions y purchases
-- Esta columna es primordial para las páginas de subastas y compras

-- 1. Agregar epa a auctions
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS epa TEXT 
CHECK (epa IS NULL OR epa IN ('SI', 'NO'));

COMMENT ON COLUMN public.auctions.epa IS 'Entrada Provisional Aduanera: SI o NO';

-- 2. Agregar epa a purchases
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS epa TEXT 
CHECK (epa IS NULL OR epa IN ('SI', 'NO'));

COMMENT ON COLUMN public.purchases.epa IS 'Entrada Provisional Aduanera: SI o NO (sincronizado desde auctions)';

-- 3. Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_auctions_epa ON public.auctions(epa);
CREATE INDEX IF NOT EXISTS idx_purchases_epa ON public.purchases(epa);
