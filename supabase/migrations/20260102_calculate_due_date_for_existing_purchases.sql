-- Migration: Calculate due_date for existing purchases that have invoice_date but no due_date
-- Created: 2026-01-02
-- Description: Update all purchases that have invoice_date but missing due_date to calculate it automatically (invoice_date + 10 days)

-- Update purchases table: calculate due_date for records that have invoice_date but no due_date
UPDATE purchases
SET due_date = (invoice_date + INTERVAL '10 days')::date,
    updated_at = NOW()
WHERE invoice_date IS NOT NULL
  AND (due_date IS NULL OR due_date = '1970-01-01'::date);

-- Update new_purchases table: calculate due_date for records that have invoice_date but no due_date
UPDATE new_purchases
SET due_date = (invoice_date + INTERVAL '10 days')::date,
    updated_at = NOW()
WHERE invoice_date IS NOT NULL
  AND (due_date IS NULL OR due_date = '1970-01-01'::date);

-- Comment
COMMENT ON COLUMN purchases.due_date IS 'Fecha de vencimiento calculada automáticamente: invoice_date + 10 días';
COMMENT ON COLUMN new_purchases.due_date IS 'Fecha de vencimiento calculada automáticamente: invoice_date + 10 días';
