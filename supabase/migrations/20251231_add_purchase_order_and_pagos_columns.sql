-- Agregar columnas faltantes en purchases relacionadas con purchase_order y módulo de pagos
-- Estas columnas son necesarias para el funcionamiento correcto de las páginas

-- ====================
-- COLUMNAS EN PURCHASES
-- ====================

-- purchase_order: Número de orden de compra (ej: PTQ001-25)
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS purchase_order TEXT;

COMMENT ON COLUMN public.purchases.purchase_order IS 'Número de orden de compra (formato: PTQ###-AA)';

-- Columnas del módulo de pagos
-- valor_factura_proveedor: Valor de la factura del proveedor
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS valor_factura_proveedor NUMERIC(15,2);

COMMENT ON COLUMN public.purchases.valor_factura_proveedor IS 'Valor de la factura del proveedor';

-- observaciones_pagos: Observaciones del módulo de pagos
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS observaciones_pagos TEXT;

COMMENT ON COLUMN public.purchases.observaciones_pagos IS 'Observaciones del módulo de pagos';

-- pendiente_a: Pendiente a (campo del módulo de pagos)
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pendiente_a TEXT;

COMMENT ON COLUMN public.purchases.pendiente_a IS 'Pendiente a (módulo de pagos)';

-- fecha_vto_fact: Fecha de vencimiento de factura
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS fecha_vto_fact DATE;

COMMENT ON COLUMN public.purchases.fecha_vto_fact IS 'Fecha de vencimiento de factura';

-- pending_marker: Marcador de pendiente
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS pending_marker TEXT;

COMMENT ON COLUMN public.purchases.pending_marker IS 'Marcador de pendiente';

-- cu: CU (campo del módulo de pagos)
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS cu TEXT;

COMMENT ON COLUMN public.purchases.cu IS 'CU (módulo de pagos)';

-- due_date: Fecha de vencimiento
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS due_date DATE;

COMMENT ON COLUMN public.purchases.due_date IS 'Fecha de vencimiento';

-- driver_name: Nombre del conductor
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS driver_name TEXT;

COMMENT ON COLUMN public.purchases.driver_name IS 'Nombre del conductor';

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_order ON public.purchases(purchase_order);
CREATE INDEX IF NOT EXISTS idx_purchases_fecha_vto_fact ON public.purchases(fecha_vto_fact);
CREATE INDEX IF NOT EXISTS idx_purchases_due_date ON public.purchases(due_date);
