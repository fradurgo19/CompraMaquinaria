-- Migración: Agregar índices para optimizar consultas de Management
-- Objetivo: Mejorar rendimiento para 10,000+ registros y múltiples usuarios simultáneos

-- Índices en purchases para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_purchases_auction_id ON purchases(auction_id) WHERE auction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_machine_id ON purchases(machine_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at_desc ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_condition ON purchases(condition);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_type ON purchases(purchase_type);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_name ON purchases(supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchases_incoterm ON purchases(incoterm);
CREATE INDEX IF NOT EXISTS idx_purchases_currency_type ON purchases(currency_type);
CREATE INDEX IF NOT EXISTS idx_purchases_shipment_type_v2 ON purchases(shipment_type_v2);

-- Índice compuesto para la consulta principal de management (auction_id + status)
-- Esto optimiza el WHERE: (p.auction_id IS NULL OR a.status = 'GANADA')
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status) WHERE status = 'GANADA';

-- Índices en machines para joins más rápidos
CREATE INDEX IF NOT EXISTS idx_machines_id ON machines(id);
CREATE INDEX IF NOT EXISTS idx_machines_brand ON machines(brand);
CREATE INDEX IF NOT EXISTS idx_machines_model ON machines(model);
CREATE INDEX IF NOT EXISTS idx_machines_machine_type ON machines(machine_type);

-- Índice en service_records para el LEFT JOIN
CREATE INDEX IF NOT EXISTS idx_service_records_purchase_id ON service_records(purchase_id);

-- Índices para campos calculados frecuentes (para filtros)
CREATE INDEX IF NOT EXISTS idx_purchases_inland_verified ON purchases(inland_verified) WHERE inland_verified = true;
CREATE INDEX IF NOT EXISTS idx_purchases_sales_state ON purchases(sales_state);

-- Comentarios sobre los índices
COMMENT ON INDEX idx_purchases_created_at_desc IS 'Índice para ordenar por fecha de creación (más recientes primero)';
COMMENT ON INDEX idx_purchases_auction_id IS 'Índice para filtrar purchases por auction_id';
COMMENT ON INDEX idx_auctions_status IS 'Índice parcial para optimizar filtro de status GANADA';
