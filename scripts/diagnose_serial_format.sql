-- Script de diagnostico: Verificar formato de seriales en purchases
-- Ejecutar este script primero para entender como estan almacenados los seriales

-- Verificar si purchases tiene columna serial directamente
SELECT 
  COUNT(*) as total_registros,
  COUNT(serial) as registros_con_serial_directo
FROM purchases;

-- Verificar si seriales estan en la tabla machines
SELECT 
  COUNT(*) as total_machines,
  COUNT(serial) as machines_con_serial
FROM machines;

-- Verificar relacion purchases -> machines
SELECT 
  COUNT(*) as total_purchases,
  COUNT(DISTINCT machine_id) as purchases_con_machine_id
FROM purchases
WHERE machine_id IS NOT NULL;

-- Ver algunos ejemplos de seriales desde machines JOIN purchases
SELECT 
  p.id as purchase_id,
  m.serial,
  m.model,
  p.inland,
  p.mq
FROM purchases p
JOIN machines m ON p.machine_id = m.id
WHERE m.serial IS NOT NULL
  AND m.serial != ''
ORDER BY m.serial
LIMIT 50;

-- Verificar si alguno de los seriales del mapeo existe en machines
SELECT 
  m.serial,
  p.inland as inland_actual,
  m.model,
  p.mq
FROM purchases p
JOIN machines m ON p.machine_id = m.id
WHERE m.serial IN ('20095', '50505', '50711', '70032', '70035', '508482', '70048')
LIMIT 20;

-- Contar cuantos purchases tienen machine_id y ese machine tiene serial
SELECT 
  COUNT(*) as total_purchases_con_serial_en_machines,
  COUNT(DISTINCT m.serial) as seriales_unicos
FROM purchases p
JOIN machines m ON p.machine_id = m.id
WHERE m.serial IS NOT NULL
  AND m.serial != '';
