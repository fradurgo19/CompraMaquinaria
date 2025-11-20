-- Migration: add CAPACIDAD and TONELAGE columns to machines table
-- Run manually: psql -U postgres -d maquinaria_usada -f backend/migrations/2025-11-15_add_capacity_tonelage_to_machines.sql

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS capacidad VARCHAR(50) CHECK (capacidad IN ('MINIS', 'MEDIANAS', 'GRANDES')),
  ADD COLUMN IF NOT EXISTS tonelage VARCHAR(50) CHECK (tonelage IN ('1.7-5.5 TONELADAS', '7.5-13.5 TONELADAS', '20.0-ADELANTE TONELADAS'));

COMMENT ON COLUMN machines.capacidad IS 'Capacidad de la máquina: MINIS, MEDIANAS, GRANDES (específico para HITACHI)';
COMMENT ON COLUMN machines.tonelage IS 'Tonelaje: 1.7-5.5 TONELADAS, 7.5-13.5 TONELADAS, 20.0-ADELANTE TONELADAS';

CREATE INDEX IF NOT EXISTS idx_machines_capacidad ON machines(capacidad);
CREATE INDEX IF NOT EXISTS idx_machines_tonelage ON machines(tonelage);

