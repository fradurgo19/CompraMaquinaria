-- Migración: Agregar columna pvp_est a new_purchases y ajustar trigger de sincronización
-- Fecha: 2026-02-23
-- Descripción: Permite al usuario definir PVP (precio de venta) en Compras Nuevos;
--              ese valor viaja a equipments.pvp_est. Si no se define, se usa el valor de compra (value).

-- 1. Agregar columna pvp_est a new_purchases
ALTER TABLE public.new_purchases
  ADD COLUMN IF NOT EXISTS pvp_est NUMERIC(15, 2) NULL;

COMMENT ON COLUMN public.new_purchases.pvp_est IS 'PVP estimado (precio de venta). Sincronizado a equipments.pvp_est. Si NULL, se usa value.';

-- 2. Actualizar trigger para usar COALESCE(pvp_est, value) al sincronizar a equipments
CREATE OR REPLACE FUNCTION sync_new_purchase_to_equipment()
RETURNS TRIGGER AS $$
DECLARE
  equipment_id UUID;
  existing_equipment_id UUID;
  pvp_value NUMERIC(15, 2);
BEGIN
  -- PVP en equipment: priorizar pvp_est de new_purchases; si no hay, usar value (valor de compra)
  pvp_value := COALESCE(NEW.pvp_est, NEW.value);

  -- Si se crea un new_purchase, crear equipment automáticamente
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO existing_equipment_id
    FROM equipments
    WHERE new_purchase_id = NEW.id;

    IF existing_equipment_id IS NULL THEN
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
        pvp_value,
        COALESCE(NEW.condition, 'NUEVO'),
        'Libre',
        NEW.machine_location,
        NOW()
      )
      RETURNING id INTO equipment_id;

      UPDATE new_purchases
      SET synced_to_equipment_id = equipment_id
      WHERE id = NEW.id;
    ELSE
      UPDATE equipments
      SET
        supplier_name = NEW.supplier_name,
        model = NEW.model,
        serial = NEW.serial,
        shipment_departure_date = NEW.shipment_departure_date,
        shipment_arrival_date = NEW.shipment_arrival_date,
        port_of_destination = NEW.port_of_loading,
        pvp_est = pvp_value,
        condition = COALESCE(NEW.condition, 'NUEVO'),
        current_movement = NEW.machine_location,
        updated_at = NOW()
      WHERE new_purchase_id = NEW.id
      RETURNING id INTO equipment_id;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE equipments
    SET
      supplier_name = NEW.supplier_name,
      model = NEW.model,
      serial = NEW.serial,
      shipment_departure_date = NEW.shipment_departure_date,
      shipment_arrival_date = NEW.shipment_arrival_date,
      port_of_destination = NEW.port_of_loading,
      pvp_est = pvp_value,
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
  'Sincroniza new_purchases a equipments. PVP: COALESCE(pvp_est, value).';
