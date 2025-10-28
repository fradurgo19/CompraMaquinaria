-- Agregar columnas manuales a la tabla purchases para el consolidado

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS inland decimal(15,2);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS gastos_pto decimal(15,2);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS flete decimal(15,2);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS traslado decimal(15,2);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS repuestos decimal(15,2);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS mant_ejec decimal(15,2);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS proyectado decimal(15,2);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS pvp_est decimal(15,2);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS comentarios text;

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS sales_state text;

COMMENT ON COLUMN purchases.inland IS 'Valor Inland (manual)';
COMMENT ON COLUMN purchases.gastos_pto IS 'Gastos Puerto (manual)';
COMMENT ON COLUMN purchases.flete IS 'Flete (manual)';
COMMENT ON COLUMN purchases.traslado IS 'Traslado (manual)';
COMMENT ON COLUMN purchases.repuestos IS 'Repuestos (manual)';
COMMENT ON COLUMN purchases.mant_ejec IS 'Mantenimiento Ejecutivo (manual)';
COMMENT ON COLUMN purchases.proyectado IS 'Proyectado (manual)';
COMMENT ON COLUMN purchases.pvp_est IS 'PVP Estimado (manual)';
COMMENT ON COLUMN purchases.comentarios IS 'Comentarios (manual)';
COMMENT ON COLUMN purchases.sales_state IS 'Estado de Venta (OK, X, BLANCO)';

