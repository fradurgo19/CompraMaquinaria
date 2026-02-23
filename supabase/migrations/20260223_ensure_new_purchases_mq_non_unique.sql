-- Asegurar que new_purchases.mq permita duplicados (agrupar/mover varias compras nuevas al mismo MQ)
-- Sin esto, al mover o agrupar compras con condición NUEVO falla: duplicate key "new_purchases_mq_key"
-- Idempotente: si ya se aplicó 20250115_allow_duplicate_mq, no hace daño.

-- Eliminar restricción UNIQUE en mq (permite mismo MQ en múltiples filas)
ALTER TABLE public.new_purchases DROP CONSTRAINT IF EXISTS new_purchases_mq_key;

-- Eliminar índice único si existe con ese nombre (pg puede crearlo con la constraint)
DROP INDEX IF EXISTS public.new_purchases_mq_key;

-- Índice no único para búsquedas
CREATE INDEX IF NOT EXISTS idx_new_purchases_mq ON public.new_purchases(mq);

COMMENT ON COLUMN public.new_purchases.mq IS 'Código de máquina (MQ). NULL = sin agrupar. Puede repetirse para múltiples unidades.';
