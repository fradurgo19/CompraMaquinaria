-- Migration: Update reported fields constraints to allow 'REPORTADO' instead of 'OK'
-- Created: 2026-01-02
-- Description: Change sales_reported, commerce_reported, and luis_lemus_reported to allow 'REPORTADO' or 'PDTE'

-- Drop old constraints
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_sales_reported_check;
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_commerce_reported_check;
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_luis_lemus_reported_check;

-- Add new constraints that allow 'REPORTADO' or 'PDTE'
ALTER TABLE purchases ADD CONSTRAINT purchases_sales_reported_check 
  CHECK (sales_reported IN ('REPORTADO', 'PDTE'));

ALTER TABLE purchases ADD CONSTRAINT purchases_commerce_reported_check 
  CHECK (commerce_reported IN ('REPORTADO', 'PDTE'));

ALTER TABLE purchases ADD CONSTRAINT purchases_luis_lemus_reported_check 
  CHECK (luis_lemus_reported IN ('REPORTADO', 'PDTE'));

-- Update any existing 'OK' values to 'REPORTADO'
UPDATE purchases SET sales_reported = 'REPORTADO' WHERE sales_reported = 'OK';
UPDATE purchases SET commerce_reported = 'REPORTADO' WHERE commerce_reported = 'OK';
UPDATE purchases SET luis_lemus_reported = 'REPORTADO' WHERE luis_lemus_reported = 'OK';

-- Comments
COMMENT ON COLUMN purchases.sales_reported IS 'Estado de reporte a ventas: REPORTADO o PDTE (por defecto)';
COMMENT ON COLUMN purchases.commerce_reported IS 'Estado de reporte a comercio: REPORTADO o PDTE (por defecto)';
COMMENT ON COLUMN purchases.luis_lemus_reported IS 'Estado de reporte a Luis Lemus: REPORTADO o PDTE (por defecto)';
