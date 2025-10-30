-- Agrega columna scope/contexto para identificar archivos de LOGISTICA
ALTER TABLE machine_files
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'GENERAL' CHECK (scope IN ('GENERAL','LOGISTICA'));

COMMENT ON COLUMN machine_files.scope IS 'Contexto del archivo: GENERAL o LOGISTICA';


