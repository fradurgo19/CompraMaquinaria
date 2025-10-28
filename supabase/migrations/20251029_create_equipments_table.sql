-- Tabla de Equipos (Maquinas para venta)
-- Combina datos de Logistica y Consolidado
CREATE TABLE IF NOT EXISTS equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  
  -- Datos de Logistica
  supplier_name TEXT,
  model TEXT,
  serial TEXT,
  shipment_departure_date DATE,
  shipment_arrival_date DATE,
  port_of_destination TEXT,
  nationalization_date DATE,
  current_movement TEXT,
  current_movement_date DATE,
  
  -- Datos de Consolidado
  year INTEGER,
  hours INTEGER,
  pvp_est NUMERIC(15, 2),
  comments TEXT,
  
  -- Especificaciones tecnicas
  full_serial NUMERIC,
  state TEXT CHECK (state IN ('Libre', 'Ok dinero y OC', 'Lista, Pendiente Entrega', 'Reservada', 'Disponible')),
  machine_type TEXT,
  wet_line TEXT CHECK (wet_line IN ('SI', 'No')),
  arm_type TEXT CHECK (arm_type IN ('ESTANDAR', 'N/A')),
  track_width NUMERIC,
  bucket_capacity NUMERIC,
  warranty_months INTEGER,
  warranty_hours INTEGER,
  engine_brand TEXT CHECK (engine_brand IN ('N/A', 'ISUZU', 'MITSUBISHI', 'FPT', 'YANMAR', 'KUBOTA', 'PERKINS', 'CUMMINS', 'CATERPILLAR', 'KOMATSU')),
  cabin_type TEXT CHECK (cabin_type IN ('N/A', 'CABINA CERRADA / AIRE ACONDICIONADO', 'CANOPY')),
  commercial_observations TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users_profile(id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_equipments_purchase_id ON equipments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_equipments_state ON equipments(state);
CREATE INDEX IF NOT EXISTS idx_equipments_machine_type ON equipments(machine_type);

-- Comentarios
COMMENT ON TABLE equipments IS 'Tabla de equipos/maquinas para venta con datos de logistica y consolidado';
COMMENT ON COLUMN equipments.state IS 'Estado del equipo: Libre, Ok dinero y OC, Lista Pendiente Entrega, Reservada, Disponible';
COMMENT ON COLUMN equipments.machine_type IS 'Tipo de maquina: BRAZO LARGO, GRUA HITACHI, etc.';
COMMENT ON COLUMN equipments.wet_line IS 'Linea humeda: SI o No';
COMMENT ON COLUMN equipments.arm_type IS 'Tipo de brazo: ESTANDAR o N/A';
COMMENT ON COLUMN equipments.engine_brand IS 'Marca del motor';
COMMENT ON COLUMN equipments.cabin_type IS 'Tipo de cabina';

