import pg from 'pg';

const { Client } = pg;

const sql = `
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
  imported_by UUID,
  
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
  imported_by UUID,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla 3: Archivos para new_purchases
CREATE TABLE IF NOT EXISTS new_purchase_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_purchase_id UUID REFERENCES new_purchases(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_auction_history_model ON auction_price_history(model);
CREATE INDEX IF NOT EXISTS idx_auction_history_year ON auction_price_history(year);
CREATE INDEX IF NOT EXISTS idx_auction_history_hours ON auction_price_history(hours);
CREATE INDEX IF NOT EXISTS idx_auction_history_brand ON auction_price_history(brand);

CREATE INDEX IF NOT EXISTS idx_pvp_history_modelo ON pvp_history(modelo);
CREATE INDEX IF NOT EXISTS idx_pvp_history_anio ON pvp_history(anio);
CREATE INDEX IF NOT EXISTS idx_pvp_history_hour ON pvp_history(hour);
CREATE INDEX IF NOT EXISTS idx_pvp_history_pvp ON pvp_history(pvp_est);
CREATE INDEX IF NOT EXISTS idx_pvp_history_rptos ON pvp_history(rptos);

CREATE INDEX IF NOT EXISTS idx_new_purchase_files_new_purchase ON new_purchase_files(new_purchase_id);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_auction_price_history_updated_at ON auction_price_history;
CREATE TRIGGER update_auction_price_history_updated_at
  BEFORE UPDATE ON auction_price_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pvp_history_updated_at ON pvp_history;
CREATE TRIGGER update_pvp_history_updated_at
  BEFORE UPDATE ON pvp_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'maquinaria_usada',
    user: 'postgres',
    password: 'password'
  });

  try {
    console.log('🔄 Conectando a la base de datos...');
    await client.connect();
    console.log('✅ Conectado');
    
    console.log('🔄 Ejecutando migración de price_history...');
    await client.query(sql);
    
    console.log('✅ Migración completada exitosamente');
    console.log('📊 Tablas creadas:');
    console.log('   - auction_price_history');
    console.log('   - pvp_history');
    console.log('   - new_purchase_files');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

runMigration();
