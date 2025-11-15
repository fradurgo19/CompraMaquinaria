-- Migration: add colombia_time column for preselection timezone tracking
-- Run manually with: psql -f backend/migrations/2025-11-15_add_colombia_time_to_preselections.sql

ALTER TABLE preselections
  ADD COLUMN IF NOT EXISTS colombia_time TIMESTAMPTZ;

