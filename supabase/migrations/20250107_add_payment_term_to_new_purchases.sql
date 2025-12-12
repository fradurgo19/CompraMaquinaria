-- Migration: Add payment_term column to new_purchases table
-- Created: 2025-01-07
-- Description: Add payment_term field for purchase order PDF generation

-- Add payment_term column to new_purchases table
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS payment_term text;

-- Add comment to column
COMMENT ON COLUMN new_purchases.payment_term IS 'Término de pago que se muestra en el PDF de orden de compra (ej: "120 days after the BL date")';

