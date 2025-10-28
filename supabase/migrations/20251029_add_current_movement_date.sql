-- Agregar columna current_movement_date a purchases
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS current_movement_date DATE;

COMMENT ON COLUMN purchases.current_movement_date IS 'Fecha del movimiento actual de la máquina';

