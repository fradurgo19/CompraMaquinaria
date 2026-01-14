-- Migration: Agregar estado 'Separada' a equipments
-- Created: 2026-01-15
-- Description: Agregar nuevo estado 'Separada' para equipos en proceso de revisión de documentos

-- Eliminar constraint existente
ALTER TABLE equipments DROP CONSTRAINT IF EXISTS equipments_state_check;

-- Agregar nuevo constraint con estado 'Separada'
ALTER TABLE equipments ADD CONSTRAINT equipments_state_check
  CHECK (state IN (
    'Libre', 
    'Ok dinero y OC', 
    'Lista, Pendiente Entrega', 
    'Reservada', 
    'Disponible',
    'Reservada con Dinero',
    'Reservada sin Dinero',
    'Separada'
  ));

COMMENT ON COLUMN equipments.state IS 'Estado del equipo: Libre, Ok dinero y OC, Lista Pendiente Entrega, Reservada, Disponible, Separada (en revisión de documentos)';
