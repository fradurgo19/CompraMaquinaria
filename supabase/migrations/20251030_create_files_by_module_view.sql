-- Vista para agrupar archivos por módulo y tipo
-- Facilita la identificación de archivos por origen (LOGISTICA, EQUIPOS, SERVICIO, GENERAL)

CREATE OR REPLACE VIEW v_files_by_module AS
SELECT 
  f.machine_id,
  m.model as machine_model,
  m.serial as machine_serial,
  f.scope as module,
  f.file_type,
  COUNT(*) as total_files,
  json_agg(
    json_build_object(
      'id', f.id,
      'file_name', f.file_name,
      'file_path', f.file_path,
      'file_size', f.file_size,
      'mime_type', f.mime_type,
      'uploaded_at', f.uploaded_at,
      'uploaded_by', f.uploaded_by
    ) ORDER BY f.uploaded_at DESC
  ) as files
FROM machine_files f
JOIN machines m ON f.machine_id = m.id
GROUP BY f.machine_id, m.model, m.serial, f.scope, f.file_type;

-- Comentario
COMMENT ON VIEW v_files_by_module IS 'Agrupa archivos por máquina, módulo (scope) y tipo (FOTO/DOCUMENTO) para facilitar el envío de correos automatizados';

