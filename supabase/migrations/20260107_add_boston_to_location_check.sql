-- Migration: Agregar BOSTON a la lista de ubicaciones permitidas en purchases
-- Created: 2026-01-07
-- Description: Agregar "BOSTON" a la lista de valores permitidos en el constraint purchases_location_check

-- Eliminar el constraint existente
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_location_check;

-- Agregar el constraint con la lista actualizada incluyendo BOSTON
ALTER TABLE purchases ADD CONSTRAINT purchases_location_check 
  CHECK (location IN (
    'KOBE', 'YOKOHAMA', 'NARITA', 'HAKATA', 'FUJI', 'TOMAKOMAI', 'SAKURA',
    'LEBANON', 'LAKE WORTH', 'NAGOYA', 'HOKKAIDO', 'OSAKA', 'ALBERTA',
    'FLORIDA', 'KASHIBA', 'HYOGO', 'MIAMI', 'BOSTON'
  ));

-- Actualizar el comentario de la columna
COMMENT ON COLUMN purchases.location IS 'Ubicación de la máquina. Valores permitidos: KOBE, YOKOHAMA, NARITA, HAKATA, FUJI, TOMAKOMAI, SAKURA, LEBANON, LAKE WORTH, NAGOYA, HOKKAIDO, OSAKA, ALBERTA, FLORIDA, KASHIBA, HYOGO, MIAMI, BOSTON';
