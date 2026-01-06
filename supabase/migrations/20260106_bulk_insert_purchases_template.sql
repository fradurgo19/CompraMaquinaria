-- Carga masiva de compras históricas - Versión simplificada
-- Reemplaza los VALUES con tus 372+ registros

-- IMPORTANTE: Asegúrate de que:
-- 1. Los machine_id y supplier_id existen en la BD
-- 2. Si usas auction_id, debe existir en auctions
-- 3. Si la máquina no existe, créala primero en machines

-- Opción 1: Si ya tienes machine_id y supplier_id (más rápido)
INSERT INTO purchases (
  machine_id, supplier_id, purchase_type, incoterm, currency_type,
  exw_value_formatted, invoice_date, due_date, trm_rate, payment_status,
  auction_id, mq, condition, shipment_type_v2, created_at, updated_at
)
VALUES
  -- Reemplaza con tus datos reales (máximo ~1000 registros por query)
  -- Formato: (machine_id, supplier_id, 'COMPRA_DIRECTA' o 'SUBASTA', 'FOB' o 'EXY', 'USD' o 'JPY', 'valor', '2024-01-15', '2024-01-25', 0, 'PENDIENTE', NULL, 'MQ-001', 'USADO', '1X40', NOW(), NOW()),
  -- Ejemplo:
  ('uuid-machine-1', 'uuid-supplier-1', 'COMPRA_DIRECTA', 'FOB', 'USD', '50000', '2024-01-15', '2024-01-25', 0, 'PENDIENTE', NULL, 'MQ-001', 'USADO', '1X40', NOW(), NOW()),
  ('uuid-machine-2', 'uuid-supplier-2', 'SUBASTA', 'EXY', 'JPY', '3000000', '2024-02-10', '2024-02-20', 0, 'PENDIENTE', 'uuid-auction-1', 'MQ-002', 'USADO', '1X40', NOW(), NOW())
  -- Agrega tus 372+ registros aquí...
;

-- Opción 2: Si solo tienes nombres (más lento pero más flexible)
-- Primero crea/obtiene suppliers y machines, luego inserta purchases
WITH 
-- Suppliers
suppliers_map AS (
  SELECT 
    name,
    COALESCE(
      (SELECT id FROM suppliers WHERE LOWER(name) = LOWER(s.name) LIMIT 1),
      gen_random_uuid()
    ) AS supplier_id
  FROM (VALUES 
    ('TOZAI'),
    ('KANEHARU')
    -- Agrega todos tus suppliers aquí
  ) AS s(name)
  WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE LOWER(suppliers.name) = LOWER(s.name))
),
new_suppliers AS (
  INSERT INTO suppliers (id, name)
  SELECT supplier_id, name FROM suppliers_map
  WHERE supplier_id NOT IN (SELECT id FROM suppliers)
  RETURNING id, name
),
all_suppliers AS (
  SELECT id, name FROM suppliers
  UNION
  SELECT id, name FROM new_suppliers
),
-- Machines (solo para compras directas)
machines_map AS (
  SELECT 
    brand, model, serial, year, hours, machine_type,
    COALESCE(
      (SELECT id FROM machines WHERE LOWER(serial) = LOWER(m.serial) LIMIT 1),
      gen_random_uuid()
    ) AS machine_id
  FROM (VALUES 
    ('HITACHI', 'ZX200', 'ZX200-12345', 2020, 5000, 'Excavadora')
    -- Agrega todas tus máquinas aquí
  ) AS m(brand, model, serial, year, hours, machine_type)
  WHERE NOT EXISTS (SELECT 1 FROM machines WHERE LOWER(machines.serial) = LOWER(m.serial))
),
new_machines AS (
  INSERT INTO machines (id, brand, model, serial, year, hours, machine_type, created_at, updated_at)
  SELECT machine_id, brand, model, serial, year, hours, machine_type, NOW(), NOW()
  FROM machines_map
  WHERE machine_id NOT IN (SELECT id FROM machines)
  RETURNING id, serial
),
all_machines AS (
  SELECT id, serial FROM machines
  UNION
  SELECT id, serial FROM new_machines
)
-- Insertar purchases
INSERT INTO purchases (
  machine_id, supplier_id, purchase_type, incoterm, currency_type,
  exw_value_formatted, invoice_date, due_date, trm_rate, payment_status,
  auction_id, mq, condition, shipment_type_v2, created_at, updated_at
)
SELECT
  am.id AS machine_id,
  asup.id AS supplier_id,
  'COMPRA_DIRECTA' AS purchase_type,
  'FOB' AS incoterm,
  'USD' AS currency_type,
  '50000' AS exw_value_formatted,
  '2024-01-15'::date AS invoice_date,
  '2024-01-25'::date AS due_date,
  0 AS trm_rate,
  'PENDIENTE' AS payment_status,
  NULL AS auction_id,
  'MQ-001' AS mq,
  'USADO' AS condition,
  '1X40' AS shipment_type_v2,
  NOW() AS created_at,
  NOW() AS updated_at
FROM all_machines am
CROSS JOIN all_suppliers asup
WHERE am.serial = 'ZX200-12345' AND asup.name = 'TOZAI'
-- Agrega más SELECTs UNION ALL para cada compra...
;

-- Crear equipments y service_records para purchases recién creados
INSERT INTO equipments (purchase_id, state, created_at, updated_at)
SELECT id, 'Libre', NOW(), NOW()
FROM purchases
WHERE created_at >= NOW() - INTERVAL '5 minutes'
ON CONFLICT (purchase_id) DO NOTHING;

INSERT INTO service_records (purchase_id, created_at, updated_at)
SELECT id, NOW(), NOW()
FROM purchases
WHERE created_at >= NOW() - INTERVAL '5 minutes'
ON CONFLICT (purchase_id) DO NOTHING;
