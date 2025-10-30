-- Ampliar CHECK de scope para permitir 'EQUIPOS'
ALTER TABLE machine_files DROP CONSTRAINT IF EXISTS machine_files_scope_check;
ALTER TABLE machine_files
  ADD CONSTRAINT machine_files_scope_check CHECK (scope IN ('GENERAL','LOGISTICA','EQUIPOS','SERVICIO'));


