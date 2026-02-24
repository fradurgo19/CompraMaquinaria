-- Agregar columna options a spec_types para definir opciones (ej: SI, NO) como en Línea Húmeda
-- Si options está vacío o null, el campo es texto libre; si tiene valores, se muestra como Select.

ALTER TABLE public.spec_types
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]';

COMMENT ON COLUMN public.spec_types.options IS 'Opciones del tipo de especificación (array de strings). Ej: ["SI","NO"]. Vacío = texto libre.';
