-- Crear tabla PRESELECTIONS
-- Fecha: 2025-11-01
-- Descripción: Módulo de preselección que alimenta automáticamente el módulo de subastas

-- 1. Crear ENUM para decision
DO $$ BEGIN
  CREATE TYPE preselection_decision AS ENUM ('PENDIENTE', 'SI', 'NO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Crear tabla preselections
CREATE TABLE IF NOT EXISTS preselections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información básica
  supplier_name VARCHAR(255) NOT NULL,
  auction_date DATE NOT NULL,
  lot_number VARCHAR(100) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(255) NOT NULL,
  serial VARCHAR(255) NOT NULL,
  year INTEGER,
  hours INTEGER,
  
  -- Información adicional
  suggested_price DECIMAL(12, 2),
  auction_url TEXT,
  
  -- Decision y estado
  decision preselection_decision DEFAULT 'PENDIENTE',
  transferred_to_auction BOOLEAN DEFAULT FALSE,
  auction_id UUID REFERENCES auctions(id) ON DELETE SET NULL,
  
  -- Comentarios
  comments TEXT,
  
  -- Auditoría
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transferred_at TIMESTAMP WITH TIME ZONE
);

-- 3. Crear índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_preselections_auction_date ON preselections(auction_date);
CREATE INDEX IF NOT EXISTS idx_preselections_decision ON preselections(decision);
CREATE INDEX IF NOT EXISTS idx_preselections_created_by ON preselections(created_by);
CREATE INDEX IF NOT EXISTS idx_preselections_transferred ON preselections(transferred_to_auction);
CREATE INDEX IF NOT EXISTS idx_preselections_supplier ON preselections(supplier_name);

-- 4. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_preselections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_preselections_updated_at
  BEFORE UPDATE ON preselections
  FOR EACH ROW
  EXECUTE FUNCTION update_preselections_updated_at();

-- 5. Comentarios
COMMENT ON TABLE preselections IS 'Módulo de preselección de equipos para subastas';
COMMENT ON COLUMN preselections.decision IS 'Decision del usuario: PENDIENTE, SI (aprobar y pasar a subasta), NO (rechazar)';
COMMENT ON COLUMN preselections.transferred_to_auction IS 'Indica si ya fue transferido a la tabla auctions';
COMMENT ON COLUMN preselections.auction_id IS 'ID de la subasta creada cuando decision=SI';
COMMENT ON COLUMN preselections.auction_url IS 'URL de la subasta online para referencia';

-- 6. Datos de ejemplo (opcional)
-- INSERT INTO preselections (supplier_name, auction_date, lot_number, brand, model, serial, year, hours, suggested_price, auction_url, created_by)
-- VALUES 
--   ('KANEHARU', '2025-11-15', 'PRE-001', 'CAT', '320D', 'ABC123', 2015, 5000, 45000, 'https://example.com/auction/001', '11111111-1111-1111-1111-111111111111');

