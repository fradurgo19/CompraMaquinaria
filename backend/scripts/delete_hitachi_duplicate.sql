-- Script SQL para eliminar el registro duplicado: HITACHI VIO80-7 123123-002 NUEVO
-- Ejecutar directamente en PostgreSQL

BEGIN;

-- 1. Identificar el registro duplicado
DO $$
DECLARE
  v_equipment_id UUID;
  v_purchase_id UUID;
  v_new_purchase_id UUID;
  v_mq TEXT;
BEGIN
  -- Buscar el equipment duplicado
  SELECT id, purchase_id, new_purchase_id, mq INTO v_equipment_id, v_purchase_id, v_new_purchase_id, v_mq
  FROM equipments
  WHERE model = 'VIO80-7' 
    AND serial = '123123-002'
    AND condition = 'NUEVO'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_equipment_id IS NULL THEN
    RAISE NOTICE 'No se encontró el registro';
    RETURN;
  END IF;

  RAISE NOTICE 'Eliminando equipment ID: %, MQ: %, Purchase ID: %, New Purchase ID: %', 
    v_equipment_id, v_mq, v_purchase_id, v_new_purchase_id;

  -- 2. Eliminar registros dependientes de equipment
  DELETE FROM equipment_reservations WHERE equipment_id = v_equipment_id;

  -- 3. Eliminar registros dependientes de purchase (si existe)
  IF v_purchase_id IS NOT NULL THEN
    DELETE FROM machine_movements WHERE purchase_id = v_purchase_id;
    DELETE FROM cost_items WHERE purchase_id = v_purchase_id;
    DELETE FROM service_records WHERE purchase_id = v_purchase_id;
    DELETE FROM change_logs WHERE table_name = 'purchases' AND record_id = v_purchase_id;
  END IF;

  -- 4. Eliminar registros dependientes de new_purchase (si existe)
  IF v_new_purchase_id IS NOT NULL THEN
    DELETE FROM service_records WHERE new_purchase_id = v_new_purchase_id;
    DELETE FROM change_logs WHERE table_name = 'new_purchases' AND record_id = v_new_purchase_id;
  END IF;

  -- 5. Eliminar el equipment
  DELETE FROM equipments WHERE id = v_equipment_id;

  -- 6. Si hay purchase_id y no tiene otros equipments, eliminar purchase
  IF v_purchase_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM equipments WHERE purchase_id = v_purchase_id) THEN
      BEGIN
        DELETE FROM purchases WHERE id = v_purchase_id;
        RAISE NOTICE 'Purchase eliminado: %', v_purchase_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo eliminar purchase (puede tener dependencias): %', SQLERRM;
      END;
    END IF;
  END IF;

  -- 7. Si hay new_purchase_id y no tiene otros equipments, eliminar new_purchase
  IF v_new_purchase_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM equipments WHERE new_purchase_id = v_new_purchase_id) THEN
      DELETE FROM new_purchases WHERE id = v_new_purchase_id;
      RAISE NOTICE 'New_purchase eliminado: %', v_new_purchase_id;
    END IF;
  END IF;

  -- 8. Si hay MQ, buscar y eliminar otros purchases/new_purchases con el mismo MQ
  IF v_mq IS NOT NULL THEN
    -- Eliminar purchases con el mismo MQ que no tengan equipments
    DELETE FROM purchases 
    WHERE mq = v_mq 
      AND NOT EXISTS (SELECT 1 FROM equipments WHERE purchase_id = purchases.id);
    
    -- Eliminar new_purchases con el mismo MQ que no tengan equipments
    DELETE FROM new_purchases 
    WHERE mq = v_mq 
      AND NOT EXISTS (SELECT 1 FROM equipments WHERE new_purchase_id = new_purchases.id);
    
    RAISE NOTICE 'Registros relacionados con MQ % eliminados', v_mq;
  END IF;

  RAISE NOTICE '✅ Eliminación completada';
END $$;

COMMIT;

-- Verificar que se eliminó
SELECT 
  'Equipments restantes' as tabla,
  COUNT(*) as cantidad
FROM equipments
WHERE model = 'VIO80-7' AND serial = '123123-002' AND condition = 'NUEVO'

UNION ALL

SELECT 
  'Purchases restantes' as tabla,
  COUNT(*) as cantidad
FROM purchases
WHERE model = 'VIO80-7' AND serial = '123123-002'

UNION ALL

SELECT 
  'New_purchases restantes' as tabla,
  COUNT(*) as cantidad
FROM new_purchases
WHERE model = 'VIO80-7' AND serial = '123123-002';

