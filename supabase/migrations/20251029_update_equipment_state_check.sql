-- Actualizar constraint de state para incluir nuevos estados
ALTER TABLE equipments DROP CONSTRAINT IF EXISTS equipments_state_check;

ALTER TABLE equipments ADD CONSTRAINT equipments_state_check
  CHECK (state IN (
    'Libre', 
    'Ok dinero y OC', 
    'Lista, Pendiente Entrega', 
    'Reservada', 
    'Disponible',
    'Reservada con Dinero',
    'Reservada sin Dinero'
  ));

