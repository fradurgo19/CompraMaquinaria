-- =====================================================
-- Migración: Agregar campo location a auctions
-- Fecha: 2025-01-15
-- Descripción: Agrega campo location para sincronización con purchases
-- =====================================================

-- Agregar columna location a auctions
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS location text CHECK (location IN (
    'KOBE', 'YOKOHAMA', 'NARITA', 'HAKATA', 'FUJI', 'TOMAKOMAI', 'SAKURA',
    'LEBANON', 'LAKE WORTH', 'NAGOYA', 'HOKKAIDO', 'OSAKA', 'ALBERTA',
    'FLORIDA', 'KASHIBA', 'HYOGO', 'MIAMI'
  ));

-- Agregar columna auction_type si no existe (viene de preselections)
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS auction_type VARCHAR(120);

-- Comentarios
COMMENT ON COLUMN auctions.location IS 'Ubicación de la subasta - se sincroniza a purchases cuando se gana';
COMMENT ON COLUMN auctions.auction_type IS 'Tipo de subasta - viene de preselections';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
