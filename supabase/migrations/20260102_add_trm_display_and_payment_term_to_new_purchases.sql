-- Migration: Add trm_display and ensure payment_term exists in new_purchases
-- Created: 2026-01-02
-- Description: Add trm_display column and ensure payment_term exists for new_purchases table

-- Add trm_display column (similar to purchases table)
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS trm_display text DEFAULT '0';

-- Ensure payment_term exists (may have been added in previous migration)
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS payment_term text;

-- Comments
COMMENT ON COLUMN new_purchases.trm_display IS 'Display de TRM como texto (similar a purchases)';
COMMENT ON COLUMN new_purchases.payment_term IS 'Términos de pago';
