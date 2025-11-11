-- =====================================================
-- Agregar columna MQ a equipments
-- Necesaria para sincronizar desde new_purchases
-- =====================================================

-- 1. Agregar columna mq a equipments
ALTER TABLE equipments 
ADD COLUMN IF NOT EXISTS mq VARCHAR(50);

-- 2. Hacer purchase_id nullable (para permitir registros de new_purchases)
ALTER TABLE equipments ALTER COLUMN purchase_id DROP NOT NULL;

-- 3. Crear índice NO único en mq (puede haber múltiples equipments para un purchase)
CREATE INDEX IF NOT EXISTS idx_equipments_mq ON equipments(mq) WHERE mq IS NOT NULL;

-- 4. Actualizar registros existentes con mq desde purchases
-- Solo actualizar el primer equipment de cada purchase para evitar duplicados
UPDATE equipments e
SET mq = p.mq
FROM purchases p
WHERE e.purchase_id = p.id
  AND e.mq IS NULL
  AND p.mq IS NOT NULL
  AND e.id = (
    SELECT e2.id 
    FROM equipments e2 
    WHERE e2.purchase_id = p.id 
    ORDER BY e2.created_at 
    LIMIT 1
  );

-- 5. Comentario
COMMENT ON COLUMN equipments.mq IS 'Código único de máquina - sincronizado desde purchases o new_purchases';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

