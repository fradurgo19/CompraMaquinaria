-- Agregar columna service_value a service_records
-- Esta columna es necesaria para el módulo de servicio

ALTER TABLE public.service_records 
ADD COLUMN IF NOT EXISTS service_value NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.service_records.service_value IS 'Valor del servicio de alistamiento';

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_service_records_service_value ON public.service_records(service_value);
