-- Migración: Agregar columna año de compra (purchase_year) a new_purchases
-- Fecha: 2026-02-23
-- Descripción: Año en que se realizó la compra; distinto de year (año de la máquina).
--              Solo se usa en el módulo Compras Nuevos (NewPurchasesPage).

ALTER TABLE public.new_purchases
  ADD COLUMN IF NOT EXISTS purchase_year INTEGER NULL;

COMMENT ON COLUMN public.new_purchases.purchase_year IS 'Año de compra (en que se realizó la compra). Distinto de year (año de la máquina).';
