-- Migration: Agregar campo first_checklist_date a equipment_reservations
-- Created: 2026-01-15
-- Description: Rastrear cuándo se marcó el primer checkbox para calcular los 10 días de revisión

ALTER TABLE equipment_reservations ADD COLUMN IF NOT EXISTS first_checklist_date TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN equipment_reservations.first_checklist_date IS 'Fecha en que se marcó el primer checkbox, inicio del período de 10 días para completar el checklist';
