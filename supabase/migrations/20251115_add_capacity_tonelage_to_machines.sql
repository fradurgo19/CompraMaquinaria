-- Migration: add CAPACIDAD and TONELAGE columns to machines table
-- Created: 2025-11-15
-- Description: Add capacity and tonnage columns to machines table

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS capacidad VARCHAR(50) CHECK (capacidad IN ('MINIS', 'MEDIANAS', 'GRANDES')),
  ADD COLUMN IF NOT EXISTS tonelage VARCHAR(50) CHECK (tonelage IN ('1.7-5.5 TONELADAS', '7.5-13.5 TONELADAS', '20.0-ADELANTE TONELADAS'));

COMMENT ON COLUMN public.machines.capacidad IS 'Capacidad de la máquina: MINIS, MEDIANAS, GRANDES (específico para HITACHI)';
COMMENT ON COLUMN public.machines.tonelage IS 'Tonelaje: 1.7-5.5 TONELADAS, 7.5-13.5 TONELADAS, 20.0-ADELANTE TONELADAS';

CREATE INDEX IF NOT EXISTS idx_machines_capacidad ON public.machines(capacidad);
CREATE INDEX IF NOT EXISTS idx_machines_tonelage ON public.machines(tonelage);

