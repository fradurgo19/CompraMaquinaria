-- Agregar columna spec_pad a machines y equipments para manejar PAD (Bueno/Malo) en equipos usados

ALTER TABLE machines
ADD COLUMN IF NOT EXISTS spec_pad VARCHAR(10) CHECK (spec_pad IN ('Bueno', 'Malo'));

COMMENT ON COLUMN machines.spec_pad IS 'Estado PAD: Bueno o Malo (solo usados)';

ALTER TABLE equipments
ADD COLUMN IF NOT EXISTS spec_pad VARCHAR(10) CHECK (spec_pad IN ('Bueno', 'Malo'));

COMMENT ON COLUMN equipments.spec_pad IS 'Estado PAD: Bueno o Malo (solo usados)';

