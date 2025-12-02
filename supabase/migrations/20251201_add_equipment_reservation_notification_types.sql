-- Migration: Add equipment reservation notification types
-- Created: 2025-12-01
-- Description: Agrega tipos de notificación para reservas de equipos

-- Eliminar la restricción existente
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Agregar nueva restricción con los tipos adicionales
ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'urgent', 
  'warning', 
  'info', 
  'success',
  'equipment_reservation',
  'equipment_reservation_approved',
  'equipment_reservation_rejected'
));

-- Comentario
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 
'Tipo de notificación: urgent, warning, info, success, equipment_reservation, equipment_reservation_approved, equipment_reservation_rejected';

