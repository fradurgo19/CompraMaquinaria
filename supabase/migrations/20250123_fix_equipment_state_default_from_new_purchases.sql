-- Migración: Corregir estado por defecto 'Libre' en equipments creados desde new_purchases
-- Fecha: 2025-01-23
-- Descripción: Actualizar el trigger sync_new_purchase_to_equipment para establecer 'Libre' como estado por defecto

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
        state,
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
        'Libre',
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

COMMENT ON FUNCTION sync_new_purchase_to_equipment() IS 
  'Sincroniza automáticamente new_purchases a equipments con estado por defecto "Libre"';

