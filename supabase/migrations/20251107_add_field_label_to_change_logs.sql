-- Agregar columna field_label a la tabla change_logs
-- Esta columna almacena el nombre amigable del campo modificado

ALTER TABLE change_logs
ADD COLUMN IF NOT EXISTS field_label VARCHAR(100);

-- Comentario para documentar el propósito de la columna
COMMENT ON COLUMN change_logs.field_label IS 'Nombre amigable/traducción del campo modificado para mostrar en UI';

