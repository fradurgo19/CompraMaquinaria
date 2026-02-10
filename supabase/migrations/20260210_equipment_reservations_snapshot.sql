-- Conservar asesor, cliente y fechas del proceso de reserva/aprobación en la línea de tiempo
-- (cuando se rechaza o se libera, el equipo se limpia pero el historial debe mostrar esos datos)
ALTER TABLE equipment_reservations ADD COLUMN IF NOT EXISTS snapshot_cliente TEXT;
ALTER TABLE equipment_reservations ADD COLUMN IF NOT EXISTS snapshot_asesor TEXT;
ALTER TABLE equipment_reservations ADD COLUMN IF NOT EXISTS snapshot_deadline DATE;

COMMENT ON COLUMN equipment_reservations.snapshot_cliente IS 'Cliente al momento del evento (Reservada/Separada/Rechazada) para historial';
COMMENT ON COLUMN equipment_reservations.snapshot_asesor IS 'Asesor al momento del evento para historial';
COMMENT ON COLUMN equipment_reservations.snapshot_deadline IS 'Fecha límite al momento del evento para historial';
