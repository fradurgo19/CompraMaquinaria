-- Migration: Add description column to new_purchases table
-- Created: 2025-01-07
-- Description: Add description field for purchase order PDF generation (shown in DESCRIPTION column)

-- Add description column to new_purchases table
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS description text;

-- Add comment to column
COMMENT ON COLUMN new_purchases.description IS 'Descripción del equipo que se muestra en la columna DESCRIPTION del PDF de orden de compra';

