-- =============================================================================
-- RESET TOTAL DE RESERVAS DE EQUIPOS - Solo para pruebas / empezar de cero
-- Ejecutar en Supabase SQL Editor (producción o staging) con precaución.
-- =============================================================================

BEGIN;

-- 1. Poner en Libre TODOS los equipos (incl. Entregada) y limpiar datos de reserva
UPDATE equipments
SET
  state = 'Libre',
  cliente = NULL,
  asesor = NULL,
  reservation_deadline_date = NULL,
  reservation_deadline_modified = FALSE,
  updated_at = NOW()
WHERE state IS NOT NULL AND state != 'Libre';

-- 2. Eliminar notificaciones vinculadas a reservas (reference_id = id de reserva)
DELETE FROM notifications
WHERE reference_id IN (SELECT id::text FROM equipment_reservations);

-- 3. Eliminar todas las reservas de equipos
DELETE FROM equipment_reservations;

-- 4. (Opcional) Limpiar entradas de change_logs por liberación/rechazo de reservas
DELETE FROM change_logs
WHERE table_name = 'equipments'
  AND field_name IN ('cliente', 'asesor')
  AND (change_reason LIKE '%Liberado%' OR change_reason LIKE '%reserva%' OR change_reason LIKE '%rechazo%');

COMMIT;

-- =============================================================================
-- VERIFICACIÓN (ejecutar en una segunda consulta si quieres comprobar el reset)
-- =============================================================================
-- Reservas restantes (debe ser 0):
--   SELECT COUNT(*) AS reservas_restantes FROM equipment_reservations;
-- Conteo por estado de equipos:
--   SELECT state, COUNT(*) FROM equipments GROUP BY state ORDER BY state;
