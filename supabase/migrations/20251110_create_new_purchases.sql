-- =====================================================
-- Migración: Módulo de COMPRAS NUEVOS
-- Fecha: 2025-11-10
-- Descripción: Crea tabla new_purchases y agrega columna condition
-- =====================================================

-- 1. CREAR TABLA new_purchases (Compras de Equipos Nuevos)
CREATE TABLE IF NOT EXISTS new_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificación básica
  mq VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(50) DEFAULT 'COMPRA DIRECTA',
  shipment VARCHAR(100),
  
  -- Proveedor
  supplier_name VARCHAR(200) NOT NULL,
  
  -- Condición (NUEVO por defecto, pero puede ser USADO)
  condition VARCHAR(20) DEFAULT 'NUEVO' CHECK (condition IN ('NUEVO', 'USADO')),
  
  -- Información de máquina
  brand VARCHAR(100),
  model VARCHAR(100) NOT NULL,
  serial VARCHAR(100) NOT NULL,
  
  -- Documentación
  purchase_order VARCHAR(100),
  invoice_number VARCHAR(100),
  invoice_date DATE,
  payment_date DATE,
  
  -- Ubicación y logística
  machine_location VARCHAR(200),
  incoterm VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'USD',
  port_of_loading VARCHAR(200),
  
  -- Fechas de embarque
  shipment_departure_date DATE,
  shipment_arrival_date DATE,
  
  -- Valor
  value NUMERIC(15, 2),
  
  -- MC (Movimiento de Máquinas - heredado de purchases)
  mc VARCHAR(50),
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT new_purchases_model_serial_unique UNIQUE (model, serial)
);

-- 2. AGREGAR COLUMNA condition A TABLAS EXISTENTES

-- purchases (importaciones de USADOS)
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'USADO' 
CHECK (condition IN ('NUEVO', 'USADO'));

-- equipments
ALTER TABLE equipments 
ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'USADO' 
CHECK (condition IN ('NUEVO', 'USADO'));

-- machine_movements (logística)
ALTER TABLE machine_movements 
ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'USADO' 
CHECK (condition IN ('NUEVO', 'USADO'));

-- service_records (servicio)
ALTER TABLE service_records 
ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'USADO' 
CHECK (condition IN ('NUEVO', 'USADO'));

-- 3. AGREGAR COLUMNA PARA TRACKING BIDIRECCIONAL

-- En new_purchases: referencia a qué tabla de destino se sincronizó
ALTER TABLE new_purchases 
ADD COLUMN IF NOT EXISTS synced_to_equipment_id UUID REFERENCES equipments(id) ON DELETE SET NULL;

-- En equipments: referencia a new_purchase de origen (si aplica)
ALTER TABLE equipments 
ADD COLUMN IF NOT EXISTS new_purchase_id UUID REFERENCES new_purchases(id) ON DELETE SET NULL;

-- 4. ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_new_purchases_mq ON new_purchases(mq);
CREATE INDEX IF NOT EXISTS idx_new_purchases_model_serial ON new_purchases(model, serial);
CREATE INDEX IF NOT EXISTS idx_new_purchases_condition ON new_purchases(condition);
CREATE INDEX IF NOT EXISTS idx_new_purchases_created_at ON new_purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_new_purchases_synced_to ON new_purchases(synced_to_equipment_id);

CREATE INDEX IF NOT EXISTS idx_purchases_condition ON purchases(condition);
CREATE INDEX IF NOT EXISTS idx_equipments_condition ON equipments(condition);
CREATE INDEX IF NOT EXISTS idx_equipments_new_purchase_id ON equipments(new_purchase_id);
CREATE INDEX IF NOT EXISTS idx_machine_movements_condition ON machine_movements(condition);
CREATE INDEX IF NOT EXISTS idx_service_records_condition ON service_records(condition);

-- 5. TRIGGER PARA updated_at
CREATE OR REPLACE FUNCTION update_new_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_new_purchases_updated_at
  BEFORE UPDATE ON new_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_new_purchases_updated_at();

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE new_purchases ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios autenticados pueden leer
CREATE POLICY "Usuarios autenticados pueden leer new_purchases"
  ON new_purchases FOR SELECT
  TO authenticated
  USING (true);

-- Política: Usuarios autenticados pueden insertar
CREATE POLICY "Usuarios autenticados pueden crear new_purchases"
  ON new_purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: Usuarios autenticados pueden actualizar
CREATE POLICY "Usuarios autenticados pueden actualizar new_purchases"
  ON new_purchases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política: Solo admin puede eliminar
CREATE POLICY "Solo admin puede eliminar new_purchases"
  ON new_purchases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profile 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. COMENTARIOS
COMMENT ON TABLE new_purchases IS 'Compras de equipos nuevos - módulo independiente para jefecomercial';
COMMENT ON COLUMN new_purchases.condition IS 'NUEVO (por defecto) o USADO (excepcional)';
COMMENT ON COLUMN new_purchases.synced_to_equipment_id IS 'ID del registro en equipments al que se sincronizó';
COMMENT ON COLUMN equipments.new_purchase_id IS 'ID del registro en new_purchases de origen (si aplica)';
COMMENT ON COLUMN equipments.condition IS 'NUEVO (de new_purchases) o USADO (de purchases)';
COMMENT ON COLUMN machine_movements.condition IS 'NUEVO (de new_purchases) o USADO (de purchases)';
COMMENT ON COLUMN service_records.condition IS 'NUEVO (de new_purchases) o USADO (de purchases)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

