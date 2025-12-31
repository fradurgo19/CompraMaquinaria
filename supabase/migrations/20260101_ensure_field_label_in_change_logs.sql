-- Asegurar que la columna field_label existe en change_logs
-- Fecha: 2026-01-01
-- Descripción: Agregar columna field_label si no existe para almacenar el nombre amigable del campo modificado

ALTER TABLE change_logs
ADD COLUMN IF NOT EXISTS field_label VARCHAR(100);

-- Comentario para documentar el propósito de la columna
COMMENT ON COLUMN change_logs.field_label IS 'Nombre amigable/traducción del campo modificado para mostrar en UI';

-- Crear índice para mejorar búsquedas por field_label si es necesario
CREATE INDEX IF NOT EXISTS idx_change_logs_field_label ON change_logs(field_label);
