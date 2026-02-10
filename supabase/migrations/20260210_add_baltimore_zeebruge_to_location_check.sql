-- Migration: Agregar BALTIMORE y ZEEBRUGE a ubicaciones permitidas (purchases y auctions)
-- Created: 2026-02-10
-- Description: Actualiza los constraints de location para incluir BALTIMORE y ZEEBRUGE,
--              manteniendo consistencia con el frontend (AuctionsPage) y el backend.

-- ========== PURCHASES ==========
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_location_check;

ALTER TABLE purchases ADD CONSTRAINT purchases_location_check
  CHECK (location IN (
    'ALBERTA', 'BALTIMORE', 'BOSTON', 'FLORIDA', 'FUJI', 'HAKATA', 'HOKKAIDO',
    'HYOGO', 'KASHIBA', 'KOBE', 'LAKE WORTH', 'LEBANON', 'LEEDS', 'MIAMI',
    'NAGOYA', 'NARITA', 'OKINAWA', 'OSAKA', 'SAKURA', 'TIANJIN', 'TOMAKOMAI',
    'YOKOHAMA', 'ZEEBRUGE'
  ));

COMMENT ON COLUMN purchases.location IS 'Ubicación de la máquina. Valores permitidos: ALBERTA, BALTIMORE, BOSTON, FLORIDA, FUJI, HAKATA, HOKKAIDO, HYOGO, KASHIBA, KOBE, LAKE WORTH, LEBANON, LEEDS, MIAMI, NAGOYA, NARITA, OKINAWA, OSAKA, SAKURA, TIANJIN, TOMAKOMAI, YOKOHAMA, ZEEBRUGE';

-- ========== AUCTIONS ==========
-- Constraint puede llamarse auctions_location_check (columna con CHECK inline)
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_location_check;

ALTER TABLE auctions ADD CONSTRAINT auctions_location_check
  CHECK (location IN (
    'ALBERTA', 'BALTIMORE', 'BOSTON', 'FLORIDA', 'FUJI', 'HAKATA', 'HOKKAIDO',
    'HYOGO', 'KASHIBA', 'KOBE', 'LAKE WORTH', 'LEBANON', 'LEEDS', 'MIAMI',
    'NAGOYA', 'NARITA', 'OKINAWA', 'OSAKA', 'SAKURA', 'TIANJIN', 'TOMAKOMAI',
    'YOKOHAMA', 'ZEEBRUGE'
  ));

COMMENT ON COLUMN auctions.location IS 'Ubicación de la subasta - se sincroniza a purchases cuando se gana';
