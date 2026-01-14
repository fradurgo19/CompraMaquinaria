-- Migration: Agregar campos de checklist a equipment_reservations
-- Created: 2026-01-15
-- Description: Agregar campos para checklist de aprobación de reservas por jefecomercial

-- Agregar campos de checklist
ALTER TABLE equipment_reservations ADD COLUMN IF NOT EXISTS consignacion_10_millones BOOLEAN DEFAULT false;
ALTER TABLE equipment_reservations ADD COLUMN IF NOT EXISTS porcentaje_10_valor_maquina BOOLEAN DEFAULT false;
ALTER TABLE equipment_reservations ADD COLUMN IF NOT EXISTS firma_documentos BOOLEAN DEFAULT false;

-- Comentarios
COMMENT ON COLUMN equipment_reservations.consignacion_10_millones IS 'Checklist: Consignación de 10 millones';
COMMENT ON COLUMN equipment_reservations.porcentaje_10_valor_maquina IS 'Checklist: 10% Valor de la máquina';
COMMENT ON COLUMN equipment_reservations.firma_documentos IS 'Checklist: Firma de Documentos';
