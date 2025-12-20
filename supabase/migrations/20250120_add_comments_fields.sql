-- Agregar columnas para comentarios de servicio y comercial en purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS comentarios_servicio text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS comentarios_comercial text;

-- Agregar columna de comentarios en service_records
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS comentarios text;

-- Comentarios
COMMENT ON COLUMN purchases.comentarios_servicio IS 'Comentarios de servicio desde consolidado (sincronizado a service_records.comentarios)';
COMMENT ON COLUMN purchases.comentarios_comercial IS 'Comentarios comerciales desde consolidado (sincronizado a equipments.commercial_observations)';
COMMENT ON COLUMN service_records.comentarios IS 'Comentarios de servicio (sincronizado desde purchases.comentarios_servicio)';
