-- =====================================================
-- Tipos de especificación definidos por el usuario y columnas extra_specs
-- =====================================================
-- Permite agregar especificaciones técnicas nuevas (ej: Llanta) desde
-- "Gestionar Especificaciones por Defecto" y guardarlas por modelo y por compra.
-- =====================================================

-- 1. Tabla de definición de tipos de especificación (ej: Tipo Cabina, Llanta)
CREATE TABLE IF NOT EXISTS spec_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(80) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spec_types_key ON spec_types(key);
COMMENT ON TABLE spec_types IS 'Tipos de especificación técnica que el usuario puede agregar (ej: Llanta, Tipo Cabina)';

-- 2. Columna extra_specs en model_specifications (valores por modelo/condición)
ALTER TABLE public.model_specifications
  ADD COLUMN IF NOT EXISTS extra_specs JSONB DEFAULT '{}';

COMMENT ON COLUMN public.model_specifications.extra_specs IS 'Especificaciones técnicas adicionales definidas por el usuario (key-value, ej: {"llanta": "RADIAL"})';

-- 3. Columna extra_specs en new_purchases (valores por compra)
ALTER TABLE public.new_purchases
  ADD COLUMN IF NOT EXISTS extra_specs JSONB DEFAULT '{}';

COMMENT ON COLUMN public.new_purchases.extra_specs IS 'Especificaciones técnicas adicionales por compra (key-value). Se muestran en el popover SPEC.';
