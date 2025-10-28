-- Agregar columna current_movement a purchases
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS current_movement TEXT;

COMMENT ON COLUMN purchases.current_movement IS 'Movimiento actual de la máquina (PARQUEADERO BUENAVENTURA, Parqueadero Cartagena, SALIO PARA CALI, etc.)';

