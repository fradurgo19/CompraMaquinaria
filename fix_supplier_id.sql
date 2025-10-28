-- Fix supplier_id in purchases table to be TEXT instead of UUID
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_supplier_id_fkey;
ALTER TABLE purchases ALTER COLUMN supplier_id TYPE TEXT;
