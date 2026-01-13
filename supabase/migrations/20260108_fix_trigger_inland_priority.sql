-- Migration: Corregir trigger update_management_table para usar purchases.inland directamente
-- Created: 2026-01-08
-- Description: El trigger debe usar purchases.inland/gastos_pto/flete directamente (asignados por gestor de gastos automáticos)
-- NO debe calcularlos desde cost_items. Estos campos son independientes y se asignan desde las reglas automáticas por modelo.

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
    
    -- IMPORTANTE: purchases.inland, gastos_pto y flete se asignan desde el gestor de gastos automáticos
    -- NO deben calcularse desde cost_items, deben usarse directamente desde purchases
    v_inland = COALESCE(NEW.inland, 0);
    v_gastos_pto = COALESCE(NEW.gastos_pto, 0);
    v_flete = COALESCE(NEW.flete, 0);
    
    -- Para otros costos (trasld, rptos, mant_ejec), calcular desde cost_items
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'TRASLD' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type = 'REPUESTOS' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type = 'MANT_EJEC' THEN amount ELSE 0 END), 0)
    INTO v_trasld, v_rptos, v_mant_ejec
    FROM cost_items
    WHERE purchase_id = v_purchase_id;
  ELSIF TG_TABLE_NAME = 'cost_items' THEN
    -- Cuando se actualiza cost_items, NO recalcular inland/gastos_pto/flete desde cost_items
    -- Estos valores vienen del gestor de gastos automáticos y están en purchases.inland
    v_purchase_id = NEW.purchase_id;
    
    -- Obtener machine_id desde purchase
    SELECT machine_id INTO v_machine_id
    FROM purchases
    WHERE id = v_purchase_id;
    
    IF v_machine_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Obtener otros datos del purchase, incluyendo inland/gastos_pto/flete que vienen del gestor
    SELECT 
      auction_id,
      incoterm,
      currency,
      usd_jpy_rate,
      fob_value,
      inland,
      gastos_pto,
      flete
    INTO 
      v_auction_id,
      v_tipo_incoterm,
      v_currency,
      v_tasa,
      v_precio_fob,
      v_inland,
      v_gastos_pto,
      v_flete
    FROM purchases
    WHERE id = v_purchase_id;
    
    -- IMPORTANTE: inland, gastos_pto y flete vienen de purchases (gestor de gastos automáticos)
    -- NO recalcular desde cost_items, solo calcular trasld, rptos, mant_ejec
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'TRASLD' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type = 'REPUESTOS' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type = 'MANT_EJEC' THEN amount ELSE 0 END), 0)
    INTO v_trasld, v_rptos, v_mant_ejec
    FROM cost_items
    WHERE purchase_id = v_purchase_id;
  END IF;

  -- VALIDACIÓN: No insertar en management_table si machine_id es null
  IF v_machine_id IS NULL THEN
    RETURN NEW;
  END IF;

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
    -- IMPORTANTE: inland, gastos_pto y flete vienen directamente de purchases (asignados por gestor de gastos automáticos)
    -- NO deben calcularse desde cost_items, usar el valor de purchases directamente
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

COMMENT ON FUNCTION update_management_table() IS 'Trigger function para actualizar management_table. Usa purchases.inland/gastos_pto/flete directamente (asignados por gestor de gastos automáticos), NO los calcula desde cost_items.';
