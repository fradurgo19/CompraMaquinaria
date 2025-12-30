-- Agregar columnas faltantes en auctions y purchases
-- Estas columnas son necesarias para el funcionamiento correcto de las páginas

-- ====================
-- 1. COLUMNAS EN AUCTIONS
-- ====================

-- auction_type: Tipo de subasta (ej: 'PUBLICA', 'PRIVADA', etc.)
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS auction_type TEXT;

COMMENT ON COLUMN public.auctions.auction_type IS 'Tipo de subasta';

-- location: Ubicación de la subasta
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS location TEXT;

COMMENT ON COLUMN public.auctions.location IS 'Ubicación de la subasta';

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_auctions_auction_type ON public.auctions(auction_type);
CREATE INDEX IF NOT EXISTS idx_auctions_location ON public.auctions(location);

-- ====================
-- 2. COLUMNAS EN PURCHASES
-- ====================

-- comentarios_servicio: Comentarios del módulo de servicio
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS comentarios_servicio TEXT;

COMMENT ON COLUMN public.purchases.comentarios_servicio IS 'Comentarios del módulo de servicio';

-- comentarios_comercial: Comentarios del módulo comercial
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS comentarios_comercial TEXT;

COMMENT ON COLUMN public.purchases.comentarios_comercial IS 'Comentarios del módulo comercial';

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_purchases_comentarios_servicio ON public.purchases(comentarios_servicio);
CREATE INDEX IF NOT EXISTS idx_purchases_comentarios_comercial ON public.purchases(comentarios_comercial);
