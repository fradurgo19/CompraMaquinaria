-- Alinear purchases_currency_check con currency_type (JPY, USD, EUR, GBP, CAD)
-- El backend hace currency = currency_type; si currency_check no incluye CAD/GBP falla el PUT.
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_currency_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_currency_check
  CHECK (currency IN ('JPY', 'USD', 'EUR', 'GBP', 'CAD'));

COMMENT ON COLUMN purchases.currency IS 'Moneda (sincronizado con currency_type): JPY, USD, EUR, GBP, CAD';
