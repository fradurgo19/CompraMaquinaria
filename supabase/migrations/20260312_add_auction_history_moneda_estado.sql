-- Añadir columnas Moneda (JPY, USD, EUR) y Estado (GANADA, PERDIDA) al histórico de subastas
-- para permitir filtrar la sugerencia solo por subastas GANADAS y mostrar moneda en preselección.

ALTER TABLE public.auction_price_history
  ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'GANADA';

COMMENT ON COLUMN public.auction_price_history.moneda IS 'Código de moneda del precio: JPY, USD, EUR';
COMMENT ON COLUMN public.auction_price_history.estado IS 'Estado de la subasta: GANADA o PERDIDA. Solo GANADA se usa en sugerencia.';

-- Índice para filtrar por estado en el algoritmo de sugerencia
CREATE INDEX IF NOT EXISTS idx_auction_history_estado ON public.auction_price_history(estado);
