-- Migración: Agregar campos faltantes a new_purchases para sincronización con importaciones
-- Fecha: 2025-12-06
-- Descripción: Agrega year, port_of_embarkation y nationalization_date a new_purchases

-- Agregar año (year)
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS year INTEGER;

-- Agregar puerto de embarque (port_of_embarkation)
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS port_of_embarkation VARCHAR(200);

-- Agregar fecha de nacionalización (nationalization_date)
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS nationalization_date DATE;

-- Comentarios
COMMENT ON COLUMN new_purchases.year IS 'Año de la máquina (para mostrar en importaciones)';
COMMENT ON COLUMN new_purchases.port_of_embarkation IS 'Puerto de embarque (para mostrar en importaciones)';
COMMENT ON COLUMN new_purchases.nationalization_date IS 'Fecha de nacionalización (sincronizado desde importaciones)';

