-- Agregar columna mc (Código de Movimiento de Maquinaria) a la tabla purchases
-- Este código es requerido antes de poder registrar movimientos logísticos

ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS mc VARCHAR(50);

-- Comentario para documentar el propósito de la columna
COMMENT ON COLUMN purchases.mc IS 'Código MC requerido para autorizar movimientos logísticos de la maquinaria';

