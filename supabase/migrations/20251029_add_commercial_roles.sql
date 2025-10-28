-- Actualizar constraint para incluir roles comerciales
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_role_check;

ALTER TABLE users_profile ADD CONSTRAINT users_profile_role_check
  CHECK (role IN ('sebastian', 'eliana', 'gerencia', 'admin', 'importaciones', 'logistica', 'comerciales', 'jefe_comercial'));

