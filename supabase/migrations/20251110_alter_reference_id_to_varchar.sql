-- Cambiar reference_id de UUID a VARCHAR para soportar identificadores flexibles
-- Esto permite usar tanto UUIDs como identificadores de texto para notificaciones agregadas

ALTER TABLE notifications 
  ALTER COLUMN reference_id TYPE VARCHAR(255) USING reference_id::text;

-- Agregar índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_notifications_reference_id 
  ON notifications(reference_id);

-- Comentario explicativo
COMMENT ON COLUMN notifications.reference_id IS 
  'ID de referencia: puede ser UUID de un registro específico o un identificador de texto para notificaciones agregadas (ej: preselection-pending)';

