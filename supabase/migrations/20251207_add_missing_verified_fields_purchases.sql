-- Migration: Add missing verified fields to purchases
-- Fecha: 2025-12-07
-- Descripción: Agregar fob_total_verified y cif_usd_verified que faltan en la migración original

-- Agregar campos de verificación faltantes
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS fob_total_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cif_usd_verified BOOLEAN DEFAULT FALSE;

-- Índices para consultas de verificación
CREATE INDEX IF NOT EXISTS idx_purchases_fob_total_verified ON purchases(fob_total_verified);
CREATE INDEX IF NOT EXISTS idx_purchases_cif_usd_verified ON purchases(cif_usd_verified);

-- Comentarios
COMMENT ON COLUMN purchases.fob_total_verified IS 'Indica si el valor de FOB Total es definitivo';
COMMENT ON COLUMN purchases.cif_usd_verified IS 'Indica si el valor de CIF USD es definitivo';

