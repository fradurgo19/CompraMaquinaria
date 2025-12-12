-- Script para analizar el esquema por módulo
-- Tablas principales a verificar

-- 1. PRESELECCIONES
SELECT 'PRESELEECCIONES - preselections' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'preselections' 
ORDER BY ordinal_position;

-- 2. SUBASTAS
SELECT 'SUBASTAS - auctions' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'auctions' 
ORDER BY ordinal_position;

-- 3. COMPRAS
SELECT 'COMPRAS - purchases' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'purchases' 
ORDER BY ordinal_position;

-- 4. COMPRAS NUEVOS
SELECT 'COMPRAS NUEVOS - new_purchases' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'new_purchases' 
ORDER BY ordinal_position;

-- 5. EQUIPOS
SELECT 'EQUIPOS - equipments' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'equipments' 
ORDER BY ordinal_position;

-- 6. SERVICIO
SELECT 'SERVICIO - service_records' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'service_records' 
ORDER BY ordinal_position;

-- 7. LOGÍSTICA
SELECT 'LOGISTICA - machine_movements' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'machine_movements' 
ORDER BY ordinal_position;

-- 8. CONSOLIDADO
SELECT 'CONSOLIDADO - management_table' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'management_table' 
ORDER BY ordinal_position;

-- 9. PAGOS (usando purchases y new_purchases)
SELECT 'PAGOS - purchases fields' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'purchases' AND column_name LIKE '%payment%' OR column_name LIKE '%pago%'
ORDER BY ordinal_position;

-- 10. COSTOS
SELECT 'COSTOS - cost_items' as modulo;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'cost_items' 
ORDER BY ordinal_position;

