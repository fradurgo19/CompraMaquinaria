-- Migration: Add driver_name column to purchases table
-- Date: 2025-12-04
-- Purpose: Almacenar el nombre del conductor cuando hay placa de movimiento

ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS driver_name TEXT;

COMMENT ON COLUMN purchases.driver_name IS 'Nombre del conductor asociado a la placa de movimiento';

