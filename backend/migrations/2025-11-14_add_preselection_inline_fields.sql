-- Migration: add inline editing support columns to preselections
-- Run manually: psql -f backend/migrations/2025-11-14_add_preselection_inline_fields.sql

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS auction_type VARCHAR(120);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS auction_country VARCHAR(120);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS currency VARCHAR(12) DEFAULT 'USD';

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS location VARCHAR(150);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS final_price NUMERIC;

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS shoe_width_mm NUMERIC;

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_pip BOOLEAN DEFAULT FALSE;

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_blade BOOLEAN DEFAULT FALSE;

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS spec_cabin VARCHAR(80);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS local_time VARCHAR(10);

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS auction_city VARCHAR(100);

