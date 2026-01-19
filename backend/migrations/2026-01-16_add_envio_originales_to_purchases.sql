-- Añadir columna de verificación de envío de originales a purchases
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS envio_originales boolean NOT NULL DEFAULT false;

-- Asegurar valor por defecto en registros existentes
UPDATE purchases SET envio_originales = COALESCE(envio_originales, false);
