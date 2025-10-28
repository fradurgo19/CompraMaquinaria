/*
  # Seed Initial Data

  ## Overview
  This migration adds sample data for testing the application:
  - Creates test suppliers
  - No user accounts (must be created manually via Supabase Auth)
  
  ## Important Notes
  - This is optional test data
  - Can be safely removed in production
  - Users must be created through Supabase Auth interface
*/

-- Insert sample suppliers
INSERT INTO suppliers (name) VALUES
  ('Ritchie Bros Japan'),
  ('IronPlanet USA'),
  ('Euro Auctions'),
  ('Stock Machinery Inc')
ON CONFLICT (name) DO NOTHING;