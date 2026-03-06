-- Migración: Agregar columna state a new_purchases para cargue masivo y sincronización a equipments
-- Fecha: 2026-03-06
-- Descripción: Permite definir el estado (Libre, Pre-Reserva, Reservada, Separada, Entregada)
--              en carga masiva; el trigger sincroniza este valor al equipo creado.

-- 1. Agregar columna state a new_purchases (valores permitidos igual que equipments para flujo principal)
ALTER TABLE public.new_purchases
  ADD COLUMN IF NOT EXISTS state TEXT NULL
  CHECK (state IS NULL OR state IN ('Libre', 'Pre-Reserva', 'Reservada', 'Separada', 'Entregada'));

COMMENT ON COLUMN public.new_purchases.state IS 'Estado inicial del equipo al sincronizar: Libre, Pre-Reserva, Reservada, Separada, Entregada. NULL = Libre por defecto.';

-- 2. Actualizar trigger para usar COALESCE(NEW.state, 'Libre') al insertar/actualizar equipments
CREATE OR REPLACE FUNCTION sync_new_purchase_to_equipment()
RETURNS TRIGGER AS $$
DECLARE
  equipment_id UUID;
  existing_equipment_id UUID;
  pvp_value NUMERIC(15, 2);
  equipment_state TEXT;
BEGIN
  pvp_value := COALESCE(NEW.pvp_est, NEW.value);
  equipment_state := COALESCE(NULLIF(TRIM(NEW.state), ''), 'Libre');

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
        equipment_state,
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
        state = equipment_state,
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
      state = equipment_state,
      current_movement = NEW.machine_location,
      updated_at = NOW()
    WHERE new_purchase_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_new_purchase_to_equipment() IS
  'Sincroniza new_purchases a equipments. PVP: COALESCE(pvp_est, value). State: COALESCE(state, Libre).';
