-- Migration: Fix foreign keys in price_history tables
-- Fecha: 2025-12-07
-- Descripción: Corregir foreign keys para usar auth.users en lugar de users

-- Eliminar constraint incorrecto si existe
ALTER TABLE auction_price_history 
  DROP CONSTRAINT IF EXISTS auction_price_history_imported_by_fkey;

ALTER TABLE pvp_history 
  DROP CONSTRAINT IF EXISTS pvp_history_imported_by_fkey;

-- Agregar constraint correcto apuntando a auth.users
ALTER TABLE auction_price_history 
  ADD CONSTRAINT auction_price_history_imported_by_fkey 
  FOREIGN KEY (imported_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE pvp_history 
  ADD CONSTRAINT pvp_history_imported_by_fkey 
  FOREIGN KEY (imported_by) REFERENCES auth.users(id) ON DELETE SET NULL;

