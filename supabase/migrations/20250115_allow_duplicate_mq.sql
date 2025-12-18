-- =====================================================
-- Migración: Permitir MQ duplicado en new_purchases
-- Fecha: 2025-01-15
-- Descripción: Elimina restricción UNIQUE de MQ para permitir que el mismo MQ se use para múltiples máquinas
-- =====================================================

-- 1. ELIMINAR RESTRICCIÓN UNIQUE DE MQ EN new_purchases
-- Esto permite que el mismo MQ se use para múltiples máquinas (1 máquina o 10 máquinas con el mismo MQ)
-- Primero intentar eliminar como constraint, luego como índice si no existe como constraint
ALTER TABLE new_purchases DROP CONSTRAINT IF EXISTS new_purchases_mq_key;
DROP INDEX IF EXISTS new_purchases_mq_key;

-- 2. MANTENER ÍNDICE NO ÚNICO PARA BÚSQUEDAS RÁPIDAS
-- El índice ya existe como idx_new_purchases_mq (no único), así que no necesitamos recrearlo
-- Solo verificamos que exista
CREATE INDEX IF NOT EXISTS idx_new_purchases_mq ON new_purchases(mq);

-- 3. COMENTARIO ACTUALIZADO
COMMENT ON COLUMN new_purchases.mq IS 'Código de máquina - puede repetirse para múltiples máquinas (ej: 1 máquina o 10 máquinas con el mismo MQ)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
