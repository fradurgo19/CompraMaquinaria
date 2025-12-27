-- Agrega campos para OCEAN y TRM OCEAN en pagos

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS ocean_pagos NUMERIC,
  ADD COLUMN IF NOT EXISTS trm_ocean NUMERIC;

ALTER TABLE new_purchases
  ADD COLUMN IF NOT EXISTS ocean_pagos NUMERIC,
  ADD COLUMN IF NOT EXISTS trm_ocean NUMERIC;

COMMENT ON COLUMN purchases.ocean_pagos IS 'Valor OCEAN/Flete para pagos';
COMMENT ON COLUMN purchases.trm_ocean IS 'TRM utilizada para OCEAN en pagos';
COMMENT ON COLUMN new_purchases.ocean_pagos IS 'Valor OCEAN/Flete para pagos';
COMMENT ON COLUMN new_purchases.trm_ocean IS 'TRM utilizada para OCEAN en pagos';

