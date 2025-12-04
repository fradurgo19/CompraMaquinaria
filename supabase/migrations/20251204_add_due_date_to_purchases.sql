-- Migration: Add due_date column to purchases table
-- Date: 2025-12-04
-- Purpose: Almacenar fecha de vencimiento que viene de new_purchases (compras nuevas)

ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS due_date DATE;

COMMENT ON COLUMN purchases.due_date IS 'Fecha de vencimiento de la factura (viene de new_purchases)';

