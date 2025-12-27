-- Recalcula columnas CIF USD y CIF Local como generadas
-- CIF USD = FOB (USD) + OCEAN (USD)
-- CIF Local (COP) = CIF (USD) * TRM (COP)
-- Nota: No se referencia fob_usd (columna generada) para evitar dependencia entre generadas.

-- Asegurar columnas generadas (idempotente)
ALTER TABLE purchases DROP COLUMN IF EXISTS cif_local;
ALTER TABLE purchases DROP COLUMN IF EXISTS cif_usd;

ALTER TABLE purchases
  ADD COLUMN cif_usd numeric GENERATED ALWAYS AS (
    CASE
      WHEN usd_jpy_rate IS NULL OR usd_jpy_rate = 0 THEN NULL
      ELSE (
        -- FOB (USD) calculado directo desde FOB ORIGEN (exw_value_formatted) y contravalor
        (COALESCE(NULLIF(exw_value_formatted, '')::numeric, 0) + COALESCE(NULLIF(fob_expenses, '')::numeric, 0) + COALESCE(disassembly_load_value, 0)) / usd_jpy_rate
      ) + COALESCE(inland, 0)
    END
  ) STORED;

ALTER TABLE purchases
  ADD COLUMN cif_local numeric GENERATED ALWAYS AS (
    CASE
      WHEN usd_jpy_rate IS NULL OR usd_jpy_rate = 0 THEN NULL
      WHEN trm_rate IS NULL OR trm_rate = 0 THEN NULL
      ELSE (
        (
          (COALESCE(NULLIF(exw_value_formatted, '')::numeric, 0) + COALESCE(NULLIF(fob_expenses, '')::numeric, 0) + COALESCE(disassembly_load_value, 0)) / usd_jpy_rate
        ) + COALESCE(inland, 0)
      ) * trm_rate
    END
  ) STORED;

COMMENT ON COLUMN purchases.cif_usd IS 'CIF USD = (FOB ORIGEN / CONTRAVALOR) + OCEAN (USD)';
COMMENT ON COLUMN purchases.cif_local IS 'CIF Local (COP) = CIF USD * TRM (COP)';

