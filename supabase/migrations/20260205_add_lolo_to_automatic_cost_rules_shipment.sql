-- Añadir LOLO al método de embarque en automatic_cost_rules (Gestor de gastos automáticos)

ALTER TABLE public.automatic_cost_rules
  DROP CONSTRAINT IF EXISTS automatic_cost_rules_shipment_method_check;

ALTER TABLE public.automatic_cost_rules
  ADD CONSTRAINT automatic_cost_rules_shipment_method_check
  CHECK (shipment_method IS NULL OR shipment_method IN ('RORO', '1X40', '1X20', 'LCL', 'AEREO', 'LOLO'));

COMMENT ON COLUMN public.automatic_cost_rules.shipment_method IS 'Método de embarque: RORO, 1X40, 1X20, LCL, AEREO, LOLO';
