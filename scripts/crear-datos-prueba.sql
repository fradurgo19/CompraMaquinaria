-- ========================================
-- Crear Datos de Prueba
-- Sistema de Gestión de Maquinaria Usada
-- ========================================

-- 1. Insertar máquinas de ejemplo
INSERT INTO machines (model, serial, year, hours) VALUES
  ('KOMATSU PC200-8', 'ABC12345', 2018, 5000),
  ('CAT 320D', 'XYZ98765', 2019, 4500),
  ('HITACHI ZX200', 'HIT55555', 2020, 3000),
  ('VOLVO EC210', 'VOL77777', 2021, 2500)
ON CONFLICT (serial) DO NOTHING;

-- 2. Insertar subastas de ejemplo
INSERT INTO auctions (
  date, lot, machine_id, price_max, supplier_id, 
  price_bought, purchase_type, status, comments, created_by
) VALUES
  (
    '2025-10-10',
    'LOT-001',
    (SELECT id FROM machines WHERE serial = 'ABC12345'),
    50000,
    (SELECT id FROM suppliers WHERE name = 'Ritchie Bros Japan'),
    48000,
    'SUBASTA',
    'GANADA',
    'Máquina en excelente estado, pintura original',
    (SELECT id FROM users_profile WHERE email = 'sebastian@partequipos.com')
  ),
  (
    '2025-10-12',
    'LOT-002',
    (SELECT id FROM machines WHERE serial = 'XYZ98765'),
    45000,
    (SELECT id FROM suppliers WHERE name = 'IronPlanet USA'),
    NULL,
    'SUBASTA',
    'PERDIDA',
    'Superamos el precio máximo',
    (SELECT id FROM users_profile WHERE email = 'sebastian@partequipos.com')
  ),
  (
    '2025-10-15',
    'LOT-003',
    (SELECT id FROM machines WHERE serial = 'HIT55555'),
    60000,
    (SELECT id FROM suppliers WHERE name = 'Euro Auctions'),
    NULL,
    'SUBASTA',
    'PENDIENTE',
    'Subasta programada para esta semana',
    (SELECT id FROM users_profile WHERE email = 'sebastian@partequipos.com')
  ),
  (
    '2025-10-01',
    'STOCK-001',
    (SELECT id FROM machines WHERE serial = 'VOL77777'),
    55000,
    (SELECT id FROM suppliers WHERE name = 'Stock Machinery Inc'),
    53000,
    'STOCK',
    'GANADA',
    'Compra directa de inventario',
    (SELECT id FROM users_profile WHERE email = 'sebastian@partequipos.com')
  )
ON CONFLICT DO NOTHING;

-- 3. Mensaje de éxito
DO $$
DECLARE
  machine_count INTEGER;
  auction_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO machine_count FROM machines;
  SELECT COUNT(*) INTO auction_count FROM auctions;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Datos de prueba creados exitosamente';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Máquinas: %', machine_count;
  RAISE NOTICE 'Subastas: %', auction_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Ahora puedes:';
  RAISE NOTICE '1. Ver las subastas en http://localhost:5173/auctions';
  RAISE NOTICE '2. Hacer clic en "Archivos" para gestionar fotos';
  RAISE NOTICE '3. Conectar OneDrive y subir archivos';
  RAISE NOTICE '========================================';
END $$;


