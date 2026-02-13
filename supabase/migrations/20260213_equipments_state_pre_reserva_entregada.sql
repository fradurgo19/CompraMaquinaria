-- Permitir estados 'Pre-Reserva' y 'Entregada' en equipments (flujo de reservas y entrega)
ALTER TABLE equipments DROP CONSTRAINT IF EXISTS equipments_state_check;

ALTER TABLE equipments ADD CONSTRAINT equipments_state_check
  CHECK (state IN (
    'Libre',
    'Pre-Reserva',
    'Reservada',
    'Separada',
    'Entregada',
    'Ok dinero y OC',
    'Lista, Pendiente Entrega',
    'Disponible',
    'Reservada con Dinero',
    'Reservada sin Dinero'
  ));

COMMENT ON COLUMN equipments.state IS 'Estado del equipo: Libre, Pre-Reserva, Reservada, Separada, Entregada (flujo principal); otros valores legacy permitidos';
