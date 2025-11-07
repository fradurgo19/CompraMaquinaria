-- Agregar columna current_movement_plate a la tabla purchases
-- Esta columna almacena la placa del vehículo utilizado en el último movimiento logístico

ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS current_movement_plate VARCHAR(50);

-- Comentario para documentar el propósito de la columna
COMMENT ON COLUMN purchases.current_movement_plate IS 'Placa del vehículo utilizado en el movimiento logístico actual';

