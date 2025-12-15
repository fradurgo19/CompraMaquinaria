-- Migration: Create brands and models tables for dynamic management
-- Created: 2025-12-07
-- Description: Create tables to store brands and models dynamically

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create models table
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
CREATE INDEX IF NOT EXISTS idx_models_name ON models(name);

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_models_updated_at
  BEFORE UPDATE ON models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial brands from constants
INSERT INTO brands (name)
VALUES 
  ('AIRMAN'),
  ('AMMANN'),
  ('CASE'),
  ('CATERPILLAR'),
  ('HITACHI'),
  ('KOBELCO'),
  ('KOMATSU'),
  ('KUBOTA'),
  ('LBX'),
  ('LIUGONG'),
  ('OKADA'),
  ('SUMITOMO'),
  ('TECOP'),
  ('YANMAR')
ON CONFLICT (name) DO NOTHING;

-- Insert initial models from constants
INSERT INTO models (name)
VALUES 
  ('ARM BOOM ZX200'),
  ('AX50U-3'),
  ('C12R'),
  ('C12R-B'),
  ('CABIN'),
  ('CABIN ZX200'),
  ('CAB_ZX120-5'),
  ('CD10R-1'),
  ('COVER TANK ZX200'),
  ('CYLINDER'),
  ('D3C'),
  ('DAT300 RS'),
  ('DENYO DLW-300LS S'),
  ('DLW-300LS'),
  ('EX5-2'),
  ('FINAL DRIVE'),
  ('K-120-3'),
  ('K120-3'),
  ('K70-3 (ZX70-3)'),
  ('SH200-5'),
  ('SH75X-3B'),
  ('SWING MOTOR'),
  ('SWIN MOTOR'),
  ('TANK COVERS'),
  ('WELDER, DAT-300RS'),
  ('ZX-200-6'),
  ('ZX-5G /-5B'),
  ('ZX17U-2'),
  ('ZX17U-5A'),
  ('ZX30U-5A'),
  ('ZX40U-3'),
  ('ZX40U-5A'),
  ('ZX40U-5B'),
  ('ZX50U-5B'),
  ('ZX70-3'),
  ('ZX75US-3'),
  ('ZX75US-5B'),
  ('ZX75US-5B BLADE'),
  ('ZX75US-A'),
  ('ZX75USK-3'),
  ('ZX75USK-5B'),
  ('ZX120-3'),
  ('ZX120-5B'),
  ('ZX120-6'),
  ('ZX130-5G'),
  ('ZX130K-6'),
  ('ZX130L-5B'),
  ('ZX135US'),
  ('ZX135US-3'),
  ('ZX135US-5B'),
  ('ZX135US-5B BLADE'),
  ('ZX135US-6'),
  ('ZX135US-6N'),
  ('ZX135USK-5B'),
  ('ZX135USK-6'),
  ('ZX200-3'),
  ('ZX200-5B'),
  ('ZX200-5G'),
  ('ZX200-6'),
  ('ZX200LC-6'),
  ('ZX200X-5B'),
  ('ZX210 LC'),
  ('ZX210H-6'),
  ('ZX210K-5B'),
  ('ZX210K-6'),
  ('ZX210LCH-5B'),
  ('ZX210LCH-5G'),
  ('ZX210LCK-6'),
  ('ZX225US-3'),
  ('ZX225US-5B'),
  ('ZX225US-6'),
  ('ZX225USR-3'),
  ('ZX225USR-5B'),
  ('ZX225USR-6'),
  ('ZX225USRLC-5B'),
  ('ZX225USRLCK-6'),
  ('ZX225USRK-6'),
  ('ZX240-6'),
  ('ZX240LC-5B'),
  ('ZX250K-6'),
  ('ZX300 LC-6'),
  ('ZX300LC-6N'),
  ('ZX330-5B'),
  ('ZX330-6'),
  ('ZX330LC-5B'),
  ('ZX345US LC-6N'),
  ('ZX350-5B'),
  ('ZX350H-5B'),
  ('ZX350K-5B'),
  ('ZX350LC-6'),
  ('ZX350LC-6N'),
  ('VIO17-1B'),
  ('VIO35-7'),
  ('VIO50-7'),
  ('VIO80-7'),
  ('909F'),
  ('915F'),
  ('920F'),
  ('922F'),
  ('933F'),
  ('AX50-3'),
  ('ZX75-7'),
  ('ZX130-5B'),
  ('ZX17U-5A'),
  ('ZX200LC-5B'),
  ('ZX210LC-5B'),
  ('ZX225USR-6'),
  ('ZX350LC-6N'),
  ('ZX350LC-5B')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for brands
CREATE POLICY "Authenticated users can view brands"
  ON brands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert brands"
  ON brands FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update brands"
  ON brands FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete brands"
  ON brands FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS policies for models
CREATE POLICY "Authenticated users can view models"
  ON models FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert models"
  ON models FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update models"
  ON models FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete models"
  ON models FOR DELETE
  TO authenticated
  USING (true);

