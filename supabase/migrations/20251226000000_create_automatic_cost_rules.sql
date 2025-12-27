-- Migration: create automatic_cost_rules table in Supabase for automatic expenses

CREATE TABLE IF NOT EXISTS public.automatic_cost_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  brand VARCHAR(120),
  tonnage_min NUMERIC,
  tonnage_max NUMERIC,
  tonnage_label VARCHAR(100),
  equipment VARCHAR(120),
  m3 NUMERIC,
  shipment_method VARCHAR(20) CHECK (shipment_method IN ('RORO', '1X40', '1X20', 'LCL', 'AEREO')),
  model_patterns TEXT[] NOT NULL DEFAULT '{}',
  ocean_usd NUMERIC,
  gastos_pto_cop NUMERIC,
  flete_cop NUMERIC,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_cost_rules_model_patterns ON public.automatic_cost_rules USING GIN (model_patterns);
CREATE INDEX IF NOT EXISTS idx_auto_cost_rules_brand ON public.automatic_cost_rules(brand);
CREATE INDEX IF NOT EXISTS idx_auto_cost_rules_shipment ON public.automatic_cost_rules(shipment_method);
CREATE INDEX IF NOT EXISTS idx_auto_cost_rules_active ON public.automatic_cost_rules(active);

COMMENT ON TABLE public.automatic_cost_rules IS 'Reglas maestras de gastos (OCEAN/Gastos Puerto/Flete) por rango de tonelaje, modelo y método de embarque';
COMMENT ON COLUMN public.automatic_cost_rules.model_patterns IS 'Listado de modelos/patrones asociados a la regla, se comparan por coincidencia exacta o prefijo';
COMMENT ON COLUMN public.automatic_cost_rules.ocean_usd IS 'Valor OCEAN/INLAND en USD';
COMMENT ON COLUMN public.automatic_cost_rules.gastos_pto_cop IS 'Gastos de Puerto en COP';
COMMENT ON COLUMN public.automatic_cost_rules.flete_cop IS 'Flete Nacional en COP';

CREATE OR REPLACE FUNCTION public.update_automatic_cost_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_automatic_cost_rules_updated_at
  BEFORE UPDATE ON public.automatic_cost_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_automatic_cost_rules_updated_at();

-- RLS: keep disabled for now; Vercel backend uses service role. Enable and add policies when exposing via anon key.
ALTER TABLE public.automatic_cost_rules DISABLE ROW LEVEL SECURITY;

