-- =====================================================
-- SISTEMA DE PRECIOS SUGERIDOS
-- Tablas para históricos de precios (Excel)
-- =====================================================

-- Tabla 1: Histórico de Precios de Subastas
CREATE TABLE IF NOT EXISTS auction_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos de la máquina
  model VARCHAR(100) NOT NULL,
  brand VARCHAR(50),
  serial VARCHAR(100),
  year INTEGER,
  hours INTEGER,
  
  -- Precio pagado en subasta
  precio_comprado NUMERIC(15,2),
  
  -- Datos de subasta (fecha opcional)
  fecha_subasta DATE,
  proveedor VARCHAR(100),
  lot_number VARCHAR(50),
  
  -- Metadatos
  notas TEXT,
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_by UUID REFERENCES users(id),
  
  -- Índices para búsqueda rápida
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla 2: Histórico de PVP Estimados (Consolidado)
CREATE TABLE IF NOT EXISTS pvp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos de la máquina
  provee VARCHAR(100),        -- Proveedor
  modelo VARCHAR(100) NOT NULL,
  serie VARCHAR(100),
  anio INTEGER,               -- Año
  hour INTEGER,               -- Horas
  
  -- Costos
  precio NUMERIC(15,2),       -- Precio FOB
  inland NUMERIC(15,2),       -- Inland
  cif_usd NUMERIC(15,2),      -- CIF USD
  cif NUMERIC(15,2),          -- CIF
  gastos_pto NUMERIC(15,2),   -- Gastos Puerto
  flete NUMERIC(15,2),        -- Flete
  trasld NUMERIC(15,2),       -- Traslado
  rptos NUMERIC(15,2),        -- Repuestos
  proyectado NUMERIC(15,2),   -- Proyectado
  pvp_est NUMERIC(15,2),      -- PVP Estimado
  
  -- Metadatos
  notas TEXT,
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar rendimiento de búsquedas
CREATE INDEX idx_auction_history_model ON auction_price_history(model);
CREATE INDEX idx_auction_history_year ON auction_price_history(year);
CREATE INDEX idx_auction_history_hours ON auction_price_history(hours);
CREATE INDEX idx_auction_history_brand ON auction_price_history(brand);

CREATE INDEX idx_pvp_history_modelo ON pvp_history(modelo);
CREATE INDEX idx_pvp_history_anio ON pvp_history(anio);
CREATE INDEX idx_pvp_history_hour ON pvp_history(hour);
CREATE INDEX idx_pvp_history_pvp ON pvp_history(pvp_est);
CREATE INDEX idx_pvp_history_rptos ON pvp_history(rptos);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auction_price_history_updated_at
  BEFORE UPDATE ON auction_price_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pvp_history_updated_at
  BEFORE UPDATE ON pvp_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE auction_price_history IS 'Histórico de precios de subastas ganadas importado desde Excel';
COMMENT ON TABLE pvp_history IS 'Histórico de PVP estimados y repuestos importado desde Excel';
COMMENT ON COLUMN pvp_history.rptos IS 'Valor histórico de repuestos para sugerencias';
COMMENT ON COLUMN pvp_history.pvp_est IS 'PVP estimado histórico para sugerencias';

