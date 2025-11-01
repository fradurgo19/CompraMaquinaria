-- Agregar columna 'brand' (marca) a la tabla machines
-- Fecha: 2025-11-01
-- Descripción: Permite almacenar la marca/fabricante de cada máquina (ej: CAT, KOMATSU, HITACHI, etc.)

-- 1. Agregar columna brand a machines
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

-- 2. Agregar índice para búsquedas por marca
CREATE INDEX IF NOT EXISTS idx_machines_brand ON machines(brand);

-- 3. Agregar comentario explicativo
COMMENT ON COLUMN machines.brand IS 'Marca o fabricante de la máquina (ej: CAT, KOMATSU, HITACHI, JOHN DEERE, VOLVO, etc.)';

-- 4. Actualizar registros existentes con marca por defecto (opcional - pueden editarse después)
-- UPDATE machines SET brand = 'N/A' WHERE brand IS NULL;

