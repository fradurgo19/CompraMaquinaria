-- Agregar columna para almacenar la ruta del PDF de orden de compra
ALTER TABLE new_purchases 
ADD COLUMN IF NOT EXISTS purchase_order_pdf_path TEXT;

-- Comentario
COMMENT ON COLUMN new_purchases.purchase_order_pdf_path IS 'Ruta del archivo PDF de la orden de compra masiva generada';

