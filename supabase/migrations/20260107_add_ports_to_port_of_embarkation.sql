-- Migration: Agregar puertos adicionales a port_of_embarkation
-- Created: 2026-01-07
-- Description: Agrega puertos comunes que están en location pero faltan en port_of_embarkation

-- Eliminar el constraint existente
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_port_of_embarkation_check;

-- Agregar el nuevo constraint con todos los puertos permitidos
ALTER TABLE purchases ADD CONSTRAINT purchases_port_of_embarkation_check 
  CHECK (port_of_embarkation IN (
    'KOBE', 'YOKOHAMA', 'SAVANNA', 'JACKSONVILLE', 'CANADA', 'MIAMI',
    'NARITA', 'HAKATA', 'FUJI', 'TOMAKOMAI', 'SAKURA', 
    'LEBANON', 'LAKE WORTH', 'NAGOYA', 'HOKKAIDO', 'OSAKA', 
    'ALBERTA', 'FLORIDA', 'KASHIBA', 'HYOGO'
  ));

COMMENT ON COLUMN purchases.port_of_embarkation IS 'Puerto de embarque - Valores permitidos: KOBE, YOKOHAMA, SAVANNA, JACKSONVILLE, CANADA, MIAMI, NARITA, HAKATA, FUJI, TOMAKOMAI, SAKURA, LEBANON, LAKE WORTH, NAGOYA, HOKKAIDO, OSAKA, ALBERTA, FLORIDA, KASHIBA, HYOGO';
