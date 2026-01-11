-- Migration: Remover constraint de tonelage en machine_spec_defaults para permitir nuevos rangos
-- Created: 2026-01-15
-- Description: Elimina el CHECK constraint en tonelage para permitir los nuevos rangos de toneladas definidos en el formulario

-- Encontrar y eliminar el constraint CHECK de tonelage
-- PostgreSQL asigna nombres automáticos a los constraints inline
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Buscar el nombre del constraint CHECK relacionado con tonelage
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.machine_spec_defaults'::regclass
      AND contype = 'c'
      AND conname LIKE '%tonelage%';
    
    -- Si se encontró, eliminarlo
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.machine_spec_defaults DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Intentar también con nombres comunes por si acaso
ALTER TABLE public.machine_spec_defaults DROP CONSTRAINT IF EXISTS machine_spec_defaults_tonelage_check;

-- Actualizar el comentario de la columna para reflejar que ahora acepta cualquier valor
COMMENT ON COLUMN public.machine_spec_defaults.tonelage IS 'Rango de toneladas (ej: 1.5 - 2.9, 3.0 - 3.9, 10-15, etc.)';
