-- Migration: Agregar columnas cliente y asesor a equipments
-- Created: 2026-01-15
-- Description: Agregar columnas para almacenar el nombre del cliente y del asesor de la última reserva

-- Agregar columna cliente ANTES de state (se agregará y luego se reordenará si es necesario)
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS cliente TEXT;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS asesor TEXT;

-- Comentarios
COMMENT ON COLUMN equipments.cliente IS 'Nombre del cliente de la última reserva';
COMMENT ON COLUMN equipments.asesor IS 'Nombre del asesor que realizó la última reserva';

-- Crear índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_equipments_cliente ON equipments(cliente);
CREATE INDEX IF NOT EXISTS idx_equipments_asesor ON equipments(asesor);
