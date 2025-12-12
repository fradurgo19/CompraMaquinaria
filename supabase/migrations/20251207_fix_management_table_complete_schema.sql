-- Migration: Complete management_table schema with all required columns
-- Fecha: 2025-12-07
-- Descripción: Agregar todas las columnas del consolidado que faltan en local

-- Agregar todos los campos del consolidado "AA2025"
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS sales_state text CHECK (sales_state IN ('OK', 'X', 'BLANCO'));
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS tipo_compra text;
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS tipo_incoterm text;
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS tasa decimal(12,6);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS precio_fob decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS inland decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS cif_usd decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS cif_local decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS gastos_pto decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS flete decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS trasld decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS rptos decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS mant_ejec decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS cost_total_arancel decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS proyectado decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS pvp_est decimal(15,2);
ALTER TABLE management_table ADD COLUMN IF NOT EXISTS comentarios_pc text;

-- Renombrar columnas existentes para evitar duplicados (solo si existen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'total_fob') THEN
    ALTER TABLE management_table RENAME COLUMN total_fob TO total_fob_old;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'total_cif') THEN
    ALTER TABLE management_table RENAME COLUMN total_cif TO total_cif_old;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'total_costs') THEN
    ALTER TABLE management_table RENAME COLUMN total_costs TO total_costs_old;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'projected_value') THEN
    ALTER TABLE management_table RENAME COLUMN projected_value TO projected_value_old;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'estimated_pvp') THEN
    ALTER TABLE management_table RENAME COLUMN estimated_pvp TO estimated_pvp_old;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_table' AND column_name = 'final_comments') THEN
    ALTER TABLE management_table RENAME COLUMN final_comments TO final_comments_old;
  END IF;
END $$;

