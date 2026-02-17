-- Restringir equipments.state al flujo oficial: Libre, Pre-Reserva, Reservada, Separada, Entregada.
-- Quitar "Lista, Pendiente Entrega", "Vendida" y demás valores legacy.

-- 1. Migrar registros con estados que se dejan de usar
UPDATE equipments
SET state = 'Entregada'
WHERE state IN ('Lista, Pendiente Entrega', 'Vendida');

UPDATE equipments
SET state = 'Libre'
WHERE state IS NOT NULL
  AND state NOT IN ('Libre', 'Pre-Reserva', 'Reservada', 'Separada', 'Entregada');

-- 2. Sustituir el CHECK por uno que solo permita los estados del flujo
ALTER TABLE equipments DROP CONSTRAINT IF EXISTS equipments_state_check;

ALTER TABLE equipments ADD CONSTRAINT equipments_state_check
  CHECK (state IN (
    'Libre',
    'Pre-Reserva',
    'Reservada',
    'Separada',
    'Entregada'
  ));

COMMENT ON COLUMN equipments.state IS 'Estado del equipo: Libre, Pre-Reserva, Reservada, Separada, Entregada (flujo principal)';
