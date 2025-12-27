-- Añade columna FOB USD generada automáticamente como FOB ORIGEN / CONTRAVALOR
-- FOB ORIGEN: exw_value_formatted (texto numérico)
-- CONTRAVALOR: usd_jpy_rate

-- Limpiar si existiera (idempotente en despliegues)
ALTER TABLE purchases DROP COLUMN IF EXISTS fob_usd;

-- Crear columna generada
ALTER TABLE purchases
  ADD COLUMN fob_usd numeric GENERATED ALWAYS AS (
    CASE
      WHEN usd_jpy_rate IS NULL OR usd_jpy_rate = 0 THEN NULL
      ELSE COALESCE(NULLIF(exw_value_formatted, '')::numeric, 0) / usd_jpy_rate
    END
  ) STORED;

COMMENT ON COLUMN purchases.fob_usd IS 'FOB USD = FOB ORIGEN / CONTRAVALOR';

