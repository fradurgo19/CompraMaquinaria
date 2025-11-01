-- Agregar columna 'brand' a la tabla purchases (denormalizado)
-- Fecha: 2025-11-01
-- Descripción: Permite almacenar la marca en purchases para evitar JOINs

-- 1. Agregar columna brand a purchases
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

-- 2. Agregar índice para búsquedas por marca
CREATE INDEX IF NOT EXISTS idx_purchases_brand ON purchases(brand);

-- 3. Agregar comentario explicativo
COMMENT ON COLUMN purchases.brand IS 'Marca o fabricante de la máquina (denormalizado para performance)';

