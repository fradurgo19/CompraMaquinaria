-- Script SQL para eliminar el registro duplicado: HITACHI VIO80-7 123123-002 MC123444
-- Ejecutar con cuidado en la base de datos PostgreSQL

-- PASO 1: Identificar los registros duplicados
-- Ejecutar estas consultas primero para ver los IDs que se van a eliminar

-- Buscar en equipments
SELECT 
  e.id as equipment_id,
  e.purchase_id,
  e.new_purchase_id,
  e.mq,
  e.model,
  e.serial,
  e.mc,
  e.condition,
  e.created_at
FROM equipments e
WHERE e.model = 'VIO80-7' 
  AND e.serial = '123123-002'
  AND e.mc = 'MC123444'
  AND e.condition = 'NUEVO'
ORDER BY e.created_at;

-- ============================================
-- PASO 2: Una vez identificados los IDs, ejecutar las siguientes eliminaciones
-- IMPORTANTE: Reemplazar 'EQUIPMENT_ID_DUPLICADO' con el ID real encontrado arriba
-- ============================================

-- Ejemplo de uso (REEMPLAZAR CON EL ID REAL):
-- BEGIN;
-- 
-- -- 1. Identificar purchase_id y new_purchase_id del equipment duplicado
-- DO $$
-- DECLARE
--   v_equipment_id UUID := 'EQUIPMENT_ID_DUPLICADO'; -- REEMPLAZAR
--   v_purchase_id UUID;
--   v_new_purchase_id UUID;
-- BEGIN
--   SELECT purchase_id, new_purchase_id INTO v_purchase_id, v_new_purchase_id
--   FROM equipments WHERE id = v_equipment_id;
-- 
--   -- 2. Eliminar registros dependientes
--   DELETE FROM equipment_reservations WHERE equipment_id = v_equipment_id;
--   DELETE FROM machine_movements WHERE purchase_id = v_purchase_id;
--   DELETE FROM cost_items WHERE purchase_id = v_purchase_id;
--   DELETE FROM service_records WHERE purchase_id = v_purchase_id OR new_purchase_id = v_new_purchase_id;
--   DELETE FROM change_logs WHERE (table_name = 'purchases' AND record_id = v_purchase_id) 
--                              OR (table_name = 'new_purchases' AND record_id = v_new_purchase_id);
-- 
--   -- 3. Eliminar el equipment
--   DELETE FROM equipments WHERE id = v_equipment_id;
-- 
--   -- 4. Verificar si hay otros equipments con el mismo purchase_id
--   IF v_purchase_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM equipments WHERE purchase_id = v_purchase_id) THEN
--     -- Intentar eliminar purchase (puede fallar si tiene otras dependencias)
--     BEGIN
--       DELETE FROM purchases WHERE id = v_purchase_id;
--     EXCEPTION WHEN OTHERS THEN
--       RAISE NOTICE 'No se pudo eliminar purchase (puede tener dependencias): %', SQLERRM;
--     END;
--   END IF;
-- 
--   -- 5. Verificar si hay otros equipments con el mismo new_purchase_id
--   IF v_new_purchase_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM equipments WHERE new_purchase_id = v_new_purchase_id) THEN
--     DELETE FROM new_purchases WHERE id = v_new_purchase_id;
--   END IF;
-- END $$;
-- 
-- COMMIT;

-- ============================================
-- ALTERNATIVA: Script directo con ID específico
-- Si ya conoces el ID del equipment duplicado, usa este script:
-- ============================================

-- BEGIN;
-- 
-- -- REEMPLAZAR 'TU_EQUIPMENT_ID_AQUI' con el ID real
-- WITH equipment_to_delete AS (
--   SELECT id, purchase_id, new_purchase_id 
--   FROM equipments 
--   WHERE id = 'TU_EQUIPMENT_ID_AQUI'::uuid
-- )
-- DELETE FROM equipments 
-- WHERE id IN (SELECT id FROM equipment_to_delete);
-- 
-- COMMIT;

