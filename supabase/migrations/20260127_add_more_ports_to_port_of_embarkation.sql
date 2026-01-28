-- Migration: Expand port_of_embarkation allowed values
-- Created: 2026-01-27
-- Description: Agrega BALTIMORE y ZEEBRUGE al constraint

-- Eliminar el constraint existente
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_port_of_embarkation_check;

-- Agregar el nuevo constraint con todos los puertos permitidos
ALTER TABLE purchases ADD CONSTRAINT purchases_port_of_embarkation_check
  CHECK (port_of_embarkation IN (
    'ALBERTA', 'AMBERES', 'AMSTERDAM', 'BALTIMORE', 'CANADA',
    'FLORIDA', 'FUJI', 'HAKATA', 'HOKKAIDO', 'HYOGO', 'JACKSONVILLE',
    'KASHIBA', 'KOBE', 'LAKE WORTH', 'LEBANON', 'MIAMI', 'NAGOYA',
    'NARITA', 'OSAKA', 'SAKURA', 'SAVANNA', 'TIANJIN', 'TOMAKOMAI',
    'YOKOHAMA', 'ZEEBRUGE'
  ));

COMMENT ON COLUMN purchases.port_of_embarkation IS 'Puerto de embarque - Valores permitidos: ALBERTA, AMBERES, AMSTERDAM, BALTIMORE, CANADA, FLORIDA, FUJI, HAKATA, HOKKAIDO, HYOGO, JACKSONVILLE, KASHIBA, KOBE, LAKE WORTH, LEBANON, MIAMI, NAGOYA, NARITA, OSAKA, SAKURA, SAVANNA, TIANJIN, TOMAKOMAI, YOKOHAMA, ZEEBRUGE';
