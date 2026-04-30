-- ID opcional para ordenar filas de carga masiva en Consolidado-CD.
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS bulk_upload_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_purchases_bulk_upload_id
ON purchases (bulk_upload_id);
