-- Tabla de Servicio sincronizada desde Logística (purchases con nacionalization_date)
CREATE TABLE IF NOT EXISTS service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL UNIQUE REFERENCES purchases(id) ON DELETE CASCADE,
  -- columnas espejo de logística/compra
  supplier_name TEXT,
  model TEXT,
  serial TEXT,
  shipment_departure_date DATE,
  shipment_arrival_date DATE,
  port_of_destination TEXT,
  nationalization_date DATE,
  current_movement TEXT,
  current_movement_date DATE,
  year INT,
  hours INT,
  -- columnas propias de servicio
  start_staging DATE,
  end_staging DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_service_records_purchase_id ON service_records(purchase_id);

COMMENT ON TABLE service_records IS 'Registros del módulo servicio, sincronizados desde logística';
COMMENT ON COLUMN service_records.start_staging IS 'Inicio alistamiento';
COMMENT ON COLUMN service_records.end_staging IS 'Fin alistamiento';

-- trigger updated_at
CREATE OR REPLACE FUNCTION update_service_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_service_records_updated_at ON service_records;
CREATE TRIGGER update_service_records_updated_at
  BEFORE UPDATE ON service_records
  FOR EACH ROW
  EXECUTE FUNCTION update_service_records_updated_at();


