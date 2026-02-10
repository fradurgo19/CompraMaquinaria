-- Flag para resaltar en morado cuando se modifica FECHA LIMITE en estado Separada
-- Historial de cambios de FECHA LIMITE se registra en change_logs (trazabilidad)

ALTER TABLE equipments
ADD COLUMN IF NOT EXISTS reservation_deadline_modified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN equipments.reservation_deadline_modified IS 'True si se modificó manualmente la fecha límite en estado Separada (resalto morado en UI)';
