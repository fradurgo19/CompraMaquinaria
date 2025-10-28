/*
  # Actualización Completa del Esquema - Sistema de Gestión de Compra de Maquinaria Usada
  
  ## Cambios Principales
  1. Agrega rol 'admin' a users_profile
  2. Expande tabla suppliers con contact_email, phone, notes
  3. Actualiza tabla auctions con photos_folder_id
  4. Redefine tabla purchases con todos los campos requeridos
  5. Renombra additional_costs a cost_items con tipos específicos
  6. Crea tabla shipping separada
  7. Crea tabla currency_rates
  8. Actualiza management_table con todos los campos del consolidado
  9. Implementa políticas RLS basadas en roles
  10. Agrega funciones de cálculo automático
*/

-- ====================
-- 1. ACTUALIZAR USERS_PROFILE
-- ====================

-- Agregar rol 'admin'
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_role_check;
ALTER TABLE users_profile ADD CONSTRAINT users_profile_role_check 
  CHECK (role IN ('sebastian', 'eliana', 'gerencia', 'admin'));

-- Agregar email si no existe
ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ====================
-- 2. ACTUALIZAR SUPPLIERS
-- ====================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ====================
-- 3. ACTUALIZAR AUCTIONS
-- ====================

-- Renombrar purchase_type valores AUCTION -> SUBASTA
-- Agregar photos_folder_id
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS photos_folder_id text;

-- Actualizar constraint de purchase_type
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_purchase_type_check;
ALTER TABLE auctions ADD CONSTRAINT auctions_purchase_type_check 
  CHECK (purchase_type IN ('SUBASTA', 'STOCK'));

-- Actualizar constraint de status  
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_status_check;
ALTER TABLE auctions ADD CONSTRAINT auctions_status_check 
  CHECK (status IN ('GANADA', 'PERDIDA', 'PENDIENTE'));

-- Renombrar columnas para consistencia
ALTER TABLE auctions RENAME COLUMN auction_date TO date;
ALTER TABLE auctions RENAME COLUMN lot_number TO lot;
ALTER TABLE auctions RENAME COLUMN max_price TO price_max;
ALTER TABLE auctions RENAME COLUMN purchased_price TO price_bought;

-- ====================
-- 4. ACTUALIZAR PURCHASES
-- ====================

-- Agregar campos faltantes
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency text DEFAULT 'JPY' CHECK (currency IN ('JPY', 'USD', 'EUR', 'COP'));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS fob_additional decimal(15,2) DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS disassembly_load decimal(15,2) DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS usd_jpy_rate decimal(10,4);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS comments text;

-- Renombrar columnas
ALTER TABLE purchases RENAME COLUMN disassembly_value TO disassembly_cost;
ALTER TABLE purchases RENAME COLUMN port TO port_of_shipment;
ALTER TABLE purchases RENAME COLUMN shipping_type TO shipment_type;

-- Actualizar constraint de incoterm
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_incoterm_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_incoterm_check 
  CHECK (incoterm IN ('EXW', 'FOB'));

-- Actualizar constraint de payment_status
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_payment_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_payment_status_check 
  CHECK (payment_status IN ('PENDIENTE', 'DESBOLSADO', 'COMPLETADO'));

-- Actualizar constraint de shipment_type
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_shipment_type_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_shipment_type_check 
  CHECK (shipment_type IN ('RORO', '1X40', '1X20', 'LCL', 'AEREO'));

-- Calcular FOB automáticamente: fob_value = exw_value + fob_additional + disassembly_load
CREATE OR REPLACE FUNCTION calculate_fob_value()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fob_value = COALESCE(NEW.exw_value, 0) + 
                  COALESCE(NEW.fob_additional, 0) + 
                  COALESCE(NEW.disassembly_load, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_fob ON purchases;
CREATE TRIGGER trigger_calculate_fob
  BEFORE INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION calculate_fob_value();

-- ====================
-- 5. RENOMBRAR Y ACTUALIZAR COST_ITEMS (antes additional_costs)
-- ====================

ALTER TABLE IF EXISTS additional_costs RENAME TO cost_items;

-- Renombrar columna concept a type
ALTER TABLE cost_items RENAME COLUMN concept TO type;

-- Actualizar constraint con tipos específicos
ALTER TABLE cost_items DROP CONSTRAINT IF EXISTS cost_items_type_check;
ALTER TABLE cost_items ADD CONSTRAINT cost_items_type_check 
  CHECK (type IN ('INLAND', 'GASTOS_PTO', 'FLETE', 'TRASLD', 'REPUESTOS', 'MANT_EJEC'));

-- Actualizar políticas RLS
DROP POLICY IF EXISTS "Authenticated users can view additional costs" ON cost_items;
DROP POLICY IF EXISTS "Authenticated users can insert additional costs" ON cost_items;
DROP POLICY IF EXISTS "Authenticated users can update additional costs" ON cost_items;
DROP POLICY IF EXISTS "Authenticated users can delete additional costs" ON cost_items;

-- ====================
-- 6. CREAR TABLA SHIPPING
-- ====================

CREATE TABLE IF NOT EXISTS shipping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases ON DELETE CASCADE,
  departure_date date,
  estimated_arrival date,
  actual_arrival date,
  carrier text,
  tracking_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shipping ENABLE ROW LEVEL SECURITY;

-- Calcular estimated_arrival automáticamente (departure + 45 días)
CREATE OR REPLACE FUNCTION calculate_estimated_arrival()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.departure_date IS NOT NULL AND NEW.estimated_arrival IS NULL THEN
    NEW.estimated_arrival = NEW.departure_date + INTERVAL '45 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_estimated_arrival
  BEFORE INSERT OR UPDATE ON shipping
  FOR EACH ROW
  EXECUTE FUNCTION calculate_estimated_arrival();

-- ====================
-- 7. CREAR TABLA CURRENCY_RATES
-- ====================

CREATE TABLE IF NOT EXISTS currency_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  pair text NOT NULL CHECK (pair IN ('USD/JPY', 'USD/COP', 'USD/EUR', 'EUR/USD', 'JPY/USD')),
  rate decimal(12,6) NOT NULL,
  source text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(date, pair)
);

ALTER TABLE currency_rates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_currency_rates_date_pair ON currency_rates(date, pair);

-- ====================
-- 8. ACTUALIZAR MANAGEMENT_TABLE (Consolidado Gerencia)
-- ====================

-- Agregar todos los campos del consolidado "AA2025"
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS sales_state text CHECK (sales_state IN ('OK', 'X', 'BLANCO'));
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS tipo_compra text;
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS tipo_incoterm text;
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS tasa decimal(12,6);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS precio_fob decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS inland decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS cif_usd decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS cif_local decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS gastos_pto decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS flete decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS trasld decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS rptos decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS mant_ejec decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS cost_total_arancel decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS proyectado decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS pvp_est decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS comentarios_pc text;

-- Renombrar columnas existentes para evitar duplicados
ALTER TABLE management_table RENAME COLUMN total_fob TO total_fob_old;
ALTER TABLE management_table RENAME COLUMN total_cif TO total_cif_old;
ALTER TABLE management_table RENAME COLUMN total_costs TO total_costs_old;
ALTER TABLE management_table RENAME COLUMN projected_value TO projected_value_old;
ALTER TABLE management_table RENAME COLUMN estimated_pvp TO estimated_pvp_old;
ALTER TABLE management_table RENAME COLUMN final_comments TO final_comments_old;

-- Función para actualizar management_table automáticamente desde auctions y purchases
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

-- Triggers para actualizar management_table
DROP TRIGGER IF EXISTS trigger_update_management_from_auction ON auctions;
CREATE TRIGGER trigger_update_management_from_auction
  AFTER INSERT OR UPDATE ON auctions
  FOR EACH ROW
  EXECUTE FUNCTION update_management_table();

DROP TRIGGER IF EXISTS trigger_update_management_from_purchase ON purchases;
CREATE TRIGGER trigger_update_management_from_purchase
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_management_table();

DROP TRIGGER IF EXISTS trigger_update_management_from_costs ON cost_items;
CREATE TRIGGER trigger_update_management_from_costs
  AFTER INSERT OR UPDATE OR DELETE ON cost_items
  FOR EACH ROW
  EXECUTE FUNCTION update_management_table();

-- ====================
-- 9. ACTUALIZAR ÍNDICES
-- ====================

CREATE INDEX IF NOT EXISTS idx_purchases_invoice_number ON purchases(invoice_number);
CREATE INDEX IF NOT EXISTS idx_cost_items_type ON cost_items(type);
CREATE INDEX IF NOT EXISTS idx_shipping_purchase_id ON shipping(purchase_id);
CREATE INDEX IF NOT EXISTS idx_shipping_departure_date ON shipping(departure_date);
CREATE INDEX IF NOT EXISTS idx_management_table_sales_state ON management_table(sales_state);

-- ====================
-- 10. TRIGGERS PARA UPDATED_AT
-- ====================

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at 
  BEFORE UPDATE ON suppliers
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipping_updated_at ON shipping;
CREATE TRIGGER update_shipping_updated_at 
  BEFORE UPDATE ON shipping
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_profile_updated_at ON users_profile;
CREATE TRIGGER update_users_profile_updated_at 
  BEFORE UPDATE ON users_profile
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- 11. POLÍTICAS RLS BASADAS EN ROLES
-- ====================

-- Función helper para obtener el rol del usuario
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM users_profile WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ====== POLICIES PARA AUCTIONS ======
-- Solo Sebastian y Gerencia pueden ver subastas
DROP POLICY IF EXISTS "Authenticated users can view auctions" ON auctions;
CREATE POLICY "Role based access to auctions"
  ON auctions FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('sebastian', 'gerencia', 'admin')
    AND (get_user_role() = 'gerencia' OR get_user_role() = 'admin' OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can insert auctions" ON auctions;
CREATE POLICY "Sebastian can create auctions"
  ON auctions FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('sebastian', 'admin'));

DROP POLICY IF EXISTS "Authenticated users can update auctions" ON auctions;
CREATE POLICY "Sebastian can update own auctions"
  ON auctions FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('sebastian', 'admin') AND (get_user_role() = 'admin' OR created_by = auth.uid()))
  WITH CHECK (get_user_role() IN ('sebastian', 'admin') AND (get_user_role() = 'admin' OR created_by = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete auctions" ON auctions;
CREATE POLICY "Only admin can delete auctions"
  ON auctions FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ====== POLICIES PARA PURCHASES ======
-- Solo Eliana y Gerencia pueden ver compras
DROP POLICY IF EXISTS "Authenticated users can view purchases" ON purchases;
CREATE POLICY "Role based access to purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('eliana', 'gerencia', 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert purchases" ON purchases;
CREATE POLICY "Eliana can create purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('eliana', 'admin'));

DROP POLICY IF EXISTS "Authenticated users can update purchases" ON purchases;
CREATE POLICY "Eliana and Gerencia can update purchases"
  ON purchases FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('eliana', 'gerencia', 'admin'))
  WITH CHECK (get_user_role() IN ('eliana', 'gerencia', 'admin'));

DROP POLICY IF EXISTS "Authenticated users can delete purchases" ON purchases;
CREATE POLICY "Only admin can delete purchases"
  ON purchases FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ====== POLICIES PARA COST_ITEMS ======
CREATE POLICY "Role based access to cost_items"
  ON cost_items FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('eliana', 'gerencia', 'admin'));

CREATE POLICY "Eliana can insert cost_items"
  ON cost_items FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('eliana', 'admin'));

CREATE POLICY "Eliana can update cost_items"
  ON cost_items FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('eliana', 'admin'))
  WITH CHECK (get_user_role() IN ('eliana', 'admin'));

CREATE POLICY "Admin can delete cost_items"
  ON cost_items FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ====== POLICIES PARA SHIPPING ======
CREATE POLICY "Role based access to shipping"
  ON shipping FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('eliana', 'gerencia', 'admin'));

CREATE POLICY "Eliana can manage shipping"
  ON shipping FOR ALL
  TO authenticated
  USING (get_user_role() IN ('eliana', 'admin'))
  WITH CHECK (get_user_role() IN ('eliana', 'admin'));

-- ====== POLICIES PARA CURRENCY_RATES ======
CREATE POLICY "All authenticated users can view currency rates"
  ON currency_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage currency rates"
  ON currency_rates FOR ALL
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ====== POLICIES PARA MANAGEMENT_TABLE ======
-- Solo Gerencia y Admin pueden ver y editar el consolidado
DROP POLICY IF EXISTS "Authenticated users can view management table" ON management_table;
CREATE POLICY "Only gerencia and admin can view management table"
  ON management_table FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('gerencia', 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert management records" ON management_table;
CREATE POLICY "System and admin can insert management records"
  ON management_table FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated users can update management records" ON management_table;
CREATE POLICY "Gerencia can update management records"
  ON management_table FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('gerencia', 'admin'))
  WITH CHECK (get_user_role() IN ('gerencia', 'admin'));

-- ====== POLICIES PARA MACHINES ======
-- Sebastián ve solo máquinas vinculadas a sus subastas
-- Eliana ve máquinas vinculadas a compras
-- Gerencia ve todo
DROP POLICY IF EXISTS "Authenticated users can view machines" ON machines;
CREATE POLICY "Role based access to machines"
  ON machines FOR SELECT
  TO authenticated
  USING (
    CASE get_user_role()
      WHEN 'sebastian' THEN 
        id IN (SELECT machine_id FROM auctions WHERE created_by = auth.uid())
      WHEN 'eliana' THEN 
        id IN (SELECT machine_id FROM purchases)
      WHEN 'gerencia' THEN true
      WHEN 'admin' THEN true
      ELSE false
    END
  );

DROP POLICY IF EXISTS "Authenticated users can insert machines" ON machines;
CREATE POLICY "Sebastian and Eliana can create machines"
  ON machines FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('sebastian', 'eliana', 'admin'));

DROP POLICY IF EXISTS "Authenticated users can update machines" ON machines;
CREATE POLICY "Users can update machines they have access to"
  ON machines FOR UPDATE
  TO authenticated
  USING (
    CASE get_user_role()
      WHEN 'sebastian' THEN 
        id IN (SELECT machine_id FROM auctions WHERE created_by = auth.uid())
      WHEN 'eliana' THEN 
        id IN (SELECT machine_id FROM purchases)
      WHEN 'gerencia' THEN true
      WHEN 'admin' THEN true
      ELSE false
    END
  )
  WITH CHECK (
    CASE get_user_role()
      WHEN 'sebastian' THEN 
        id IN (SELECT machine_id FROM auctions WHERE created_by = auth.uid())
      WHEN 'eliana' THEN 
        id IN (SELECT machine_id FROM purchases)
      WHEN 'gerencia' THEN true
      WHEN 'admin' THEN true
      ELSE false
    END
  );

-- ====== POLICIES PARA SUPPLIERS ======
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON suppliers;

CREATE POLICY "All authenticated can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sebastian and Eliana can create suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('sebastian', 'eliana', 'admin'));

CREATE POLICY "Users can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('sebastian', 'eliana', 'gerencia', 'admin'))
  WITH CHECK (get_user_role() IN ('sebastian', 'eliana', 'gerencia', 'admin'));

-- ====================
-- 12. VISTAS PARA CONSULTAS COMUNES
-- ====================

-- Vista completa de subastas con relaciones
CREATE OR REPLACE VIEW v_auctions_complete AS
SELECT 
  a.*,
  m.model, m.serial, m.year, m.hours,
  s.name as supplier_name,
  u.full_name as created_by_name
FROM auctions a
LEFT JOIN machines m ON a.machine_id = m.id
LEFT JOIN suppliers s ON a.supplier_id = s.id
LEFT JOIN users_profile u ON a.created_by = u.id;

-- Vista completa de compras con relaciones
CREATE OR REPLACE VIEW v_purchases_complete AS
SELECT 
  p.*,
  m.model, m.serial, m.year, m.hours,
  s.name as supplier_name,
  u.full_name as created_by_name,
  sh.departure_date, sh.estimated_arrival, sh.actual_arrival
FROM purchases p
LEFT JOIN machines m ON p.machine_id = m.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN users_profile u ON p.created_by = u.id
LEFT JOIN shipping sh ON p.id = sh.purchase_id;

-- Vista del consolidado de gerencia
CREATE OR REPLACE VIEW v_management_consolidado AS
SELECT 
  mt.*,
  m.model, m.serial, m.year,
  a.date as auction_date, a.status as auction_status,
  p.invoice_number, p.invoice_date
FROM management_table mt
LEFT JOIN machines m ON mt.machine_id = m.id
LEFT JOIN auctions a ON mt.auction_id = a.id
LEFT JOIN purchases p ON mt.purchase_id = p.id;

-- Otorgar permisos en las vistas
GRANT SELECT ON v_auctions_complete TO authenticated;
GRANT SELECT ON v_purchases_complete TO authenticated;
GRANT SELECT ON v_management_consolidado TO authenticated;

