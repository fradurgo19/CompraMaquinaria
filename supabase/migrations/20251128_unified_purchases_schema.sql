-- =====================================================
-- MIGRACIÓN: Esquema Unificado para Purchases y New_Purchases
-- =====================================================
-- Esta migración permite que equipments y service_records
-- referencien tanto purchases como new_purchases, eliminando
-- la necesidad de espejos duplicados.
-- =====================================================

-- 1. HACER purchase_id NULLABLE EN EQUIPMENTS
-- Ya existe new_purchase_id, solo necesitamos hacer purchase_id opcional
ALTER TABLE equipments 
  ALTER COLUMN purchase_id DROP NOT NULL;

-- Agregar constraint: al menos uno de purchase_id o new_purchase_id debe existir
ALTER TABLE equipments
  ADD CONSTRAINT check_equipments_has_reference 
  CHECK (purchase_id IS NOT NULL OR new_purchase_id IS NOT NULL);

-- 2. AGREGAR new_purchase_id A SERVICE_RECORDS
ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS new_purchase_id UUID REFERENCES new_purchases(id) ON DELETE CASCADE;

-- Hacer purchase_id nullable en service_records
ALTER TABLE service_records 
  ALTER COLUMN purchase_id DROP NOT NULL;

-- Remover constraint UNIQUE de purchase_id (ahora puede haber múltiples con new_purchase_id)
ALTER TABLE service_records
  DROP CONSTRAINT IF EXISTS service_records_purchase_id_key;

-- Agregar constraint: al menos uno de purchase_id o new_purchase_id debe existir
ALTER TABLE service_records
  ADD CONSTRAINT check_service_records_has_reference 
  CHECK (purchase_id IS NOT NULL OR new_purchase_id IS NOT NULL);

-- 3. ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_service_records_new_purchase_id ON service_records(new_purchase_id);
CREATE INDEX IF NOT EXISTS idx_equipments_purchase_or_new ON equipments(COALESCE(purchase_id::text, new_purchase_id::text));

-- 4. VISTA UNIFICADA PARA CONSULTAS
-- Esta vista combina purchases y new_purchases para consultas unificadas
CREATE OR REPLACE VIEW v_unified_purchases AS
SELECT 
  -- Identificadores
  COALESCE('purchase-' || p.id::text, 'new_purchase-' || np.id::text) as unified_id,
  COALESCE(p.id, np.id) as id,
  CASE WHEN p.id IS NOT NULL THEN 'purchase' ELSE 'new_purchase' END as source_table,
  COALESCE(p.id, np.id) as source_id,
  
  -- MQ (identificador común)
  COALESCE(p.mq, np.mq) as mq,
  
  -- Datos básicos
  COALESCE(p.supplier_name, np.supplier_name) as supplier_name,
  COALESCE(p.model, np.model) as model,
  COALESCE(p.serial, np.serial) as serial,
  COALESCE(p.brand, np.brand, m.brand) as brand,
  COALESCE(p.condition, np.condition, 'USADO') as condition,
  
  -- Fechas
  COALESCE(p.invoice_date, np.invoice_date) as invoice_date,
  COALESCE(p.payment_date, np.payment_date) as payment_date,
  COALESCE(p.shipment_departure_date, np.shipment_departure_date) as shipment_departure_date,
  COALESCE(p.shipment_arrival_date, np.shipment_arrival_date) as shipment_arrival_date,
  p.nationalization_date,
  
  -- Ubicación y logística
  COALESCE(p.port_of_destination, np.port_of_loading) as port_of_destination,
  COALESCE(p.current_movement, np.machine_location) as current_movement,
  p.current_movement_date,
  p.mc,
  
  -- Valores
  COALESCE(p.pvp_est, np.value) as pvp_est,
  p.exw_value,
  p.fob_value,
  
  -- Otros
  COALESCE(p.incoterm, np.incoterm, 'EXW') as incoterm,
  COALESCE(p.currency_type, np.currency, 'USD') as currency,
  COALESCE(p.purchase_type, np.type, 'COMPRA_DIRECTA') as purchase_type,
  COALESCE(p.payment_status, 
    CASE WHEN np.payment_date IS NOT NULL THEN 'COMPLETADO' ELSE 'PENDIENTE' END
  ) as payment_status,
  
  -- Referencias
  p.machine_id,
  p.auction_id,
  p.supplier_id,
  m.year,
  m.hours,
  
  -- Timestamps
  COALESCE(p.created_at, np.created_at) as created_at,
  COALESCE(p.updated_at, np.updated_at) as updated_at,
  COALESCE(p.created_by, np.created_by) as created_by
  
FROM purchases p
FULL OUTER JOIN new_purchases np ON p.mq = np.mq
LEFT JOIN machines m ON p.machine_id = m.id;

COMMENT ON VIEW v_unified_purchases IS 'Vista unificada que combina purchases y new_purchases para consultas simplificadas';

-- 5. FUNCIÓN PARA OBTENER purchase_id O new_purchase_id
-- Útil para queries que necesitan saber qué tabla referenciar
CREATE OR REPLACE FUNCTION get_purchase_reference(unified_id TEXT)
RETURNS TABLE(
  purchase_id UUID,
  new_purchase_id UUID,
  source_table TEXT
) AS $$
BEGIN
  IF unified_id LIKE 'purchase-%' THEN
    RETURN QUERY
    SELECT 
      (SELECT id::uuid FROM purchases WHERE id::text = REPLACE(unified_id, 'purchase-', ''))::uuid,
      NULL::uuid,
      'purchase'::text;
  ELSIF unified_id LIKE 'new_purchase-%' THEN
    RETURN QUERY
    SELECT 
      NULL::uuid,
      (SELECT id::uuid FROM new_purchases WHERE id::text = REPLACE(unified_id, 'new_purchase-', ''))::uuid,
      'new_purchase'::text;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. ACTUALIZAR TRIGGERS PARA SINCRONIZACIÓN AUTOMÁTICA
-- Trigger para sincronizar new_purchases -> equipments automáticamente
CREATE OR REPLACE FUNCTION sync_new_purchase_to_equipment()
RETURNS TRIGGER AS $$
DECLARE
  equipment_id UUID;
  existing_equipment_id UUID;
BEGIN
  -- Si se crea un new_purchase, crear equipment automáticamente
  IF TG_OP = 'INSERT' THEN
    -- Verificar si ya existe un equipment con este new_purchase_id
    SELECT id INTO existing_equipment_id
    FROM equipments
    WHERE new_purchase_id = NEW.id;
    
    IF existing_equipment_id IS NULL THEN
      -- No existe, crear nuevo
      INSERT INTO equipments (
        new_purchase_id,
        mq,
        supplier_name,
        model,
        serial,
        shipment_departure_date,
        shipment_arrival_date,
        port_of_destination,
        pvp_est,
        condition,
        current_movement,
        created_at
      ) VALUES (
        NEW.id,
        NEW.mq,
        NEW.supplier_name,
        NEW.model,
        NEW.serial,
        NEW.shipment_departure_date,
        NEW.shipment_arrival_date,
        NEW.port_of_loading,
        NEW.value,
        COALESCE(NEW.condition, 'NUEVO'),
        NEW.machine_location,
        NOW()
      )
      RETURNING id INTO equipment_id;
      
      -- Actualizar referencia en new_purchases
      UPDATE new_purchases 
      SET synced_to_equipment_id = equipment_id 
      WHERE id = NEW.id;
    ELSE
      -- Ya existe, actualizar
      UPDATE equipments
      SET
        supplier_name = NEW.supplier_name,
        model = NEW.model,
        serial = NEW.serial,
        shipment_departure_date = NEW.shipment_departure_date,
        shipment_arrival_date = NEW.shipment_arrival_date,
        port_of_destination = NEW.port_of_loading,
        pvp_est = NEW.value,
        condition = COALESCE(NEW.condition, 'NUEVO'),
        current_movement = NEW.machine_location,
        updated_at = NOW()
      WHERE new_purchase_id = NEW.id
      RETURNING id INTO equipment_id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Si se actualiza, sincronizar equipment
  IF TG_OP = 'UPDATE' THEN
    UPDATE equipments
    SET
      supplier_name = NEW.supplier_name,
      model = NEW.model,
      serial = NEW.serial,
      shipment_departure_date = NEW.shipment_departure_date,
      shipment_arrival_date = NEW.shipment_arrival_date,
      port_of_destination = NEW.port_of_loading,
      pvp_est = NEW.value,
      condition = COALESCE(NEW.condition, 'NUEVO'),
      current_movement = NEW.machine_location,
      updated_at = NOW()
    WHERE new_purchase_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_new_purchase_to_equipment ON new_purchases;
CREATE TRIGGER trigger_sync_new_purchase_to_equipment
  AFTER INSERT OR UPDATE ON new_purchases
  FOR EACH ROW
  EXECUTE FUNCTION sync_new_purchase_to_equipment();

-- Trigger para sincronizar new_purchases -> service_records automáticamente
CREATE OR REPLACE FUNCTION sync_new_purchase_to_service()
RETURNS TRIGGER AS $$
DECLARE
  existing_service_id UUID;
BEGIN
  -- Si se crea un new_purchase, crear service_record automáticamente
  IF TG_OP = 'INSERT' THEN
    -- Verificar si ya existe un service_record con este new_purchase_id
    SELECT id INTO existing_service_id
    FROM service_records
    WHERE new_purchase_id = NEW.id;
    
    IF existing_service_id IS NULL THEN
      -- No existe, crear nuevo
      INSERT INTO service_records (
        new_purchase_id,
        supplier_name,
        model,
        serial,
        shipment_departure_date,
        shipment_arrival_date,
        port_of_destination,
        current_movement,
        current_movement_date,
        condition,
        created_at
      ) VALUES (
        NEW.id,
        NEW.supplier_name,
        NEW.model,
        NEW.serial,
        NEW.shipment_departure_date,
        NEW.shipment_arrival_date,
        NEW.port_of_loading,
        NEW.machine_location,
        NULL,
        COALESCE(NEW.condition, 'NUEVO'),
        NOW()
      );
    ELSE
      -- Ya existe, actualizar
      UPDATE service_records
      SET
        supplier_name = NEW.supplier_name,
        model = NEW.model,
        serial = NEW.serial,
        shipment_departure_date = NEW.shipment_departure_date,
        shipment_arrival_date = NEW.shipment_arrival_date,
        port_of_destination = NEW.port_of_loading,
        current_movement = NEW.machine_location,
        condition = COALESCE(NEW.condition, 'NUEVO'),
        updated_at = NOW()
      WHERE new_purchase_id = NEW.id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Si se actualiza, sincronizar service_record
  IF TG_OP = 'UPDATE' THEN
    UPDATE service_records
    SET
      supplier_name = NEW.supplier_name,
      model = NEW.model,
      serial = NEW.serial,
      shipment_departure_date = NEW.shipment_departure_date,
      shipment_arrival_date = NEW.shipment_arrival_date,
      port_of_destination = NEW.port_of_loading,
      current_movement = NEW.machine_location,
      condition = COALESCE(NEW.condition, 'NUEVO'),
      updated_at = NOW()
    WHERE new_purchase_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_new_purchase_to_service ON new_purchases;
CREATE TRIGGER trigger_sync_new_purchase_to_service
  AFTER INSERT OR UPDATE ON new_purchases
  FOR EACH ROW
  EXECUTE FUNCTION sync_new_purchase_to_service();

-- 7. COMENTARIOS
COMMENT ON CONSTRAINT check_equipments_has_reference ON equipments IS 
  'Garantiza que equipment tenga referencia a purchase o new_purchase';
COMMENT ON CONSTRAINT check_service_records_has_reference ON service_records IS 
  'Garantiza que service_record tenga referencia a purchase o new_purchase';
COMMENT ON FUNCTION sync_new_purchase_to_equipment() IS 
  'Sincroniza automáticamente new_purchases a equipments';
COMMENT ON FUNCTION sync_new_purchase_to_service() IS 
  'Sincroniza automáticamente new_purchases a service_records';

