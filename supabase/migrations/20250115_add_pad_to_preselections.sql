-- =====================================================
-- Migración: Agregar campo PAD a preselections
-- Fecha: 2025-01-15
-- Descripción: Agrega campo spec_pad para especificaciones de preselección
-- =====================================================

-- Agregar columna spec_pad a preselections
ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_pad VARCHAR(10) CHECK (spec_pad IN ('Bueno', 'Malo'));

-- Comentario
COMMENT ON COLUMN preselections.spec_pad IS 'Estado del PAD: Bueno o Malo';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
