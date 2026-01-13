-- Script de diagnostico: Verificar formato de seriales en purchases
-- Ejecutar este script primero para entender como estan almacenados los seriales

-- Ver algunos ejemplos de seriales existentes
SELECT 
  serial,
  LENGTH(serial) as longitud,
  inland,
  model,
  mq
FROM purchases
WHERE serial IS NOT NULL
  AND serial != ''
ORDER BY serial
LIMIT 50;

-- Verificar si alguno de los seriales del mapeo existe (prueba simple)
SELECT 
  p.serial,
  p.inland as inland_actual,
  p.model
FROM purchases p
WHERE p.serial IN ('20095', '50505', '50711', '70032', '70035', '508482', '70048')
LIMIT 20;

-- Contar cuantos registros tienen serial
SELECT 
  COUNT(*) as total_con_serial,
  COUNT(DISTINCT serial) as seriales_unicos
FROM purchases
WHERE serial IS NOT NULL
  AND serial != '';
