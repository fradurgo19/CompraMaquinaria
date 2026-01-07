-- Migration: Corregir trigger update_management_table para validar machine_id
-- Created: 2026-01-07
-- Description: Agregar validación para evitar insertar en management_table si machine_id es null
-- IMPORTANTE: No modifica el flujo de datos, solo agrega validación de seguridad

CREATE OR REPLACE FUNCTION update_management_table()
RETURNS TRIGGER AS $$
DECLARE
  v_machine_id uuid;
  v_auction_id uuid;
  v_purchase_id uuid;
  v_tipo_compra text;
  v_tipo_incoterm text;
  v_currency text;
  v_tasa decimal;
  v_precio_fob decimal;
  v_inland decimal;
  v_gastos_pto decimal;
  v_flete decimal;
  v_trasld decimal;
  v_rptos decimal;
  v_mant_ejec decimal;
BEGIN
  -- Determinar el machine_id
  IF TG_TABLE_NAME = 'auctions' THEN
    v_machine_id = NEW.machine_id;
    v_auction_id = NEW.id;
    v_tipo_compra = NEW.purchase_type;
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_machine_id = NEW.machine_id;
    v_purchase_id = NEW.id;
    v_auction_id = NEW.auction_id;
    v_tipo_incoterm = NEW.incoterm;
    v_currency = NEW.currency;
    v_tasa = NEW.usd_jpy_rate;
    v_precio_fob = NEW.fob_value;
  END IF;

  -- VALIDACIÓN: No insertar en management_table si machine_id es null
  -- Esto previene errores de constraint NOT NULL
  IF v_machine_id IS NULL THEN
    -- Si machine_id es null, simplemente retornar sin hacer nada
    -- El registro se creará cuando machine_id esté disponible
    RETURN NEW;
  END IF;

  -- Calcular costos desde cost_items
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'INLAND' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'GASTOS_PTO' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'FLETE' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'TRASLD' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'REPUESTOS' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'MANT_EJEC' THEN amount ELSE 0 END), 0)
  INTO v_inland, v_gastos_pto, v_flete, v_trasld, v_rptos, v_mant_ejec
  FROM cost_items
  WHERE purchase_id = v_purchase_id;

  -- Insertar o actualizar management_table
  INSERT INTO management_table (
    machine_id, auction_id, purchase_id, tipo_compra, tipo_incoterm,
    currency, tasa, precio_fob, inland, gastos_pto, flete, trasld, rptos, mant_ejec
  )
  VALUES (
    v_machine_id, v_auction_id, v_purchase_id, v_tipo_compra, v_tipo_incoterm,
    v_currency, v_tasa, v_precio_fob, v_inland, v_gastos_pto, v_flete, v_trasld, v_rptos, v_mant_ejec
  )
  ON CONFLICT (machine_id) DO UPDATE SET
    auction_id = COALESCE(EXCLUDED.auction_id, management_table.auction_id),
    purchase_id = COALESCE(EXCLUDED.purchase_id, management_table.purchase_id),
    tipo_compra = COALESCE(EXCLUDED.tipo_compra, management_table.tipo_compra),
    tipo_incoterm = COALESCE(EXCLUDED.tipo_incoterm, management_table.tipo_incoterm),
    currency = COALESCE(EXCLUDED.currency, management_table.currency),
    tasa = COALESCE(EXCLUDED.tasa, management_table.tasa),
    precio_fob = COALESCE(EXCLUDED.precio_fob, management_table.precio_fob),
    inland = COALESCE(EXCLUDED.inland, management_table.inland),
    gastos_pto = COALESCE(EXCLUDED.gastos_pto, management_table.gastos_pto),
    flete = COALESCE(EXCLUDED.flete, management_table.flete),
    trasld = COALESCE(EXCLUDED.trasld, management_table.trasld),
    rptos = COALESCE(EXCLUDED.rptos, management_table.rptos),
    mant_ejec = COALESCE(EXCLUDED.mant_ejec, management_table.mant_ejec),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_management_table() IS 'Trigger function para actualizar management_table automáticamente. Incluye validación para evitar insertar si machine_id es null.';
