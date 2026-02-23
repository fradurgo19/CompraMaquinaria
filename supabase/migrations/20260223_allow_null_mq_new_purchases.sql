-- Permitir NULL en new_purchases.mq para desagrupar (igual que purchases.mq)
-- Así el endpoint ungroup-mq puede usar SET mq = NULL en ambas tablas
ALTER TABLE public.new_purchases
  ALTER COLUMN mq DROP NOT NULL;

COMMENT ON COLUMN public.new_purchases.mq IS 'Código de máquina (MQ). NULL = sin agrupar. Puede repetirse para múltiples unidades.';
