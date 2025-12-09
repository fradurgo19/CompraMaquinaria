-- Migración: Agregar campos de pagos a new_purchases
-- Fecha: 2025-12-06
-- Descripción: Agrega contravalor (usd_jpy_rate) y trm (trm_rate) a new_purchases para sincronización desde pagos

-- Agregar contravalor (usd_jpy_rate)
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS usd_jpy_rate NUMERIC(10,2);

-- Agregar TRM (trm_rate)
ALTER TABLE new_purchases ADD COLUMN IF NOT EXISTS trm_rate NUMERIC(10,2);

-- Comentarios
COMMENT ON COLUMN new_purchases.usd_jpy_rate IS 'Contravalor (USD/JPY rate) - sincronizado desde pagos';
COMMENT ON COLUMN new_purchases.trm_rate IS 'TRM (Tasa Representativa del Mercado) - sincronizado desde pagos';

