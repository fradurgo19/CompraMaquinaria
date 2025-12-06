-- Script para eliminar registro duplicado: HITACHI VIO80-7 123123-002 MC123444
-- Ejecutar con cuidado, verificar los IDs antes de ejecutar

-- Paso 1: Identificar el registro duplicado
-- Buscar en equipments
SELECT 
  e.id as equipment_id,
  e.purchase_id,
  e.new_purchase_id,
  e.mq,
  e.model,
  e.serial,
  e.mc,
  e.condition
FROM equipments e
WHERE e.model = 'VIO80-7' 
  AND e.serial = '123123-002'
  AND e.mc = 'MC123444'
  AND e.condition = 'NUEVO'
ORDER BY e.created_at;

-- Buscar en purchases
SELECT 
  p.id as purchase_id,
  p.mq,
  p.model,
  p.serial,
  p.mc,
  p.condition
FROM purchases p
WHERE p.model = 'VIO80-7' 
  AND p.serial = '123123-002'
  AND p.mc = 'MC123444'
ORDER BY p.created_at;

-- Buscar en new_purchases
SELECT 
  np.id as new_purchase_id,
  np.mq,
  np.model,
  np.serial,
  np.mc,
  np.condition
FROM new_purchases np
WHERE np.model = 'VIO80-7' 
  AND np.serial = '123123-002'
  AND np.mc = 'MC123444'
ORDER BY np.created_at;

-- ============================================
-- PASO 2: Una vez identificados los IDs, ejecutar las siguientes eliminaciones
-- IMPORTANTE: Reemplazar los IDs con los valores reales encontrados arriba
-- ============================================

-- Ejemplo (REEMPLAZAR CON LOS IDs REALES):
-- DECLARE @equipment_id_to_delete UUID = 'ID_DEL_EQUIPMENT_DUPLICADO';
-- DECLARE @purchase_id_to_delete UUID = 'ID_DEL_PURCHASE_DUPLICADO';
-- DECLARE @new_purchase_id_to_delete UUID = 'ID_DEL_NEW_PURCHASE_DUPLICADO';

-- Paso 2.1: Eliminar registros dependientes de equipment
-- DELETE FROM equipment_reservations WHERE equipment_id = @equipment_id_to_delete;
-- DELETE FROM equipment_files WHERE equipment_id = @equipment_id_to_delete;

-- Paso 2.2: Eliminar registros dependientes de purchase
-- DELETE FROM machine_movements WHERE purchase_id = @purchase_id_to_delete;
-- DELETE FROM cost_items WHERE purchase_id = @purchase_id_to_delete;
-- DELETE FROM service_records WHERE purchase_id = @purchase_id_to_delete;
-- DELETE FROM change_logs WHERE table_name = 'purchases' AND record_id = @purchase_id_to_delete;

-- Paso 2.3: Eliminar registros dependientes de new_purchase
-- DELETE FROM service_records WHERE new_purchase_id = @new_purchase_id_to_delete;
-- DELETE FROM change_logs WHERE table_name = 'new_purchases' AND record_id = @new_purchase_id_to_delete;

-- Paso 2.4: Eliminar el equipment
-- DELETE FROM equipments WHERE id = @equipment_id_to_delete;

-- Paso 2.5: Eliminar el purchase (si no tiene machine_id requerido, puede fallar)
-- DELETE FROM purchases WHERE id = @purchase_id_to_delete;

-- Paso 2.6: Eliminar el new_purchase
-- DELETE FROM new_purchases WHERE id = @new_purchase_id_to_delete;

