-- Migration: Add reservation_deadline_date column to equipments table
-- Created: 2025-12-08
-- Description: Add column to store the deadline date for reservations (20 days from when state changes to Reservada)

-- Add reservation_deadline_date column to equipments
ALTER TABLE equipments 
ADD COLUMN IF NOT EXISTS reservation_deadline_date DATE;

-- Add comment
COMMENT ON COLUMN equipments.reservation_deadline_date IS 'Fecha límite de reserva (calculada automáticamente 20 días después de cambiar estado a Reservada)';

