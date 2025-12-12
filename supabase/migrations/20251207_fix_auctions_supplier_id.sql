-- Migration: Fix auctions supplier_id to match local schema
-- Fecha: 2025-12-07
-- Descripción: Cambiar supplier_id de uuid a text para consistencia con purchases

-- Si existe como uuid, cambiar a text
-- Primero eliminar foreign key constraint si existe
ALTER TABLE auctions 
  DROP CONSTRAINT IF EXISTS auctions_supplier_id_fkey;

-- Cambiar tipo de dato
ALTER TABLE auctions 
  ALTER COLUMN supplier_id TYPE text USING supplier_id::text;

-- Actualizar constraint de status si no está correcto
ALTER TABLE auctions 
  DROP CONSTRAINT IF EXISTS auctions_status_check;

ALTER TABLE auctions 
  ADD CONSTRAINT auctions_status_check 
  CHECK (status IN ('GANADA', 'PERDIDA', 'PENDIENTE', 'WON', 'LOST', 'PENDING'));

-- Comentario
COMMENT ON COLUMN auctions.supplier_id IS 'ID del proveedor como texto (consistente con purchases)';

