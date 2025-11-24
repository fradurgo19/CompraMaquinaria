-- Migration: Add 'pagos' role to users_profile
-- Created: 2025-11-22
-- Description: Add 'pagos' role to support independent pagos module users

-- Update CHECK constraint to include 'pagos' role
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_role_check;

ALTER TABLE users_profile ADD CONSTRAINT users_profile_role_check 
  CHECK (role IN (
    'sebastian', 
    'eliana', 
    'gerencia', 
    'admin', 
    'importaciones', 
    'logistica', 
    'servicio', 
    'comerciales', 
    'jefe_comercial',
    'pagos'
  ));

COMMENT ON COLUMN users_profile.role IS 'User role: sebastian (auctions), eliana (purchases), pagos (payments), gerencia (management), admin (all), importaciones, logistica, servicio, comerciales, jefe_comercial';

