-- Agregar columna empresa a new_purchases
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS empresa VARCHAR(50);

-- Agregar comentario
COMMENT ON COLUMN new_purchases.empresa IS 'Empresa: Partequipos Maquinaria o Maquitecno';

-- Agregar columna empresa a purchases para sincronización
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS empresa VARCHAR(50);

COMMENT ON COLUMN purchases.empresa IS 'Empresa: Partequipos Maquinaria o Maquitecno (origen: new_purchases)';

