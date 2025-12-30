-- Semilla de reglas automáticas de gastos para Hitachi ZX (contenedor / RORO)
-- Usa rangos de tonelaje, modelos y costos provistos por logística/pagos.

WITH rules AS (
  SELECT *
  FROM (
    VALUES
      -- ton_min, ton_max, name, base, patterns[], m3, shipment, ocean_usd, gastos_pto_cop, flete_cop
      (1.5, 2.9, 'Hitachi ZX17 1.5-2.9T', 'ZX17', ARRAY['ZX17U-2','ZX17U-5A'], 8.5, '1X40', 600, 1100000, 2300000),
      (3.0, 3.9, 'Hitachi ZX30/35 3-3.9T', 'ZX30 / ZX35', ARRAY['ZX30U-3','ZX30U-5A','ZX35U-5A'], 18, '1X40', 700, NULL, NULL),
      (4.0, 5.5, 'Hitachi ZX40/50 4-5.5T', 'ZX40 / 50', ARRAY['ZX40U-5B','ZX50U-5B'], 28, '1X40', 900, 3000000, 4000000),
      (7.0, 8.5, 'Hitachi ZX75 7-8.5T', 'ZX75', ARRAY['ZX75US-5B','ZX75USK-5B'], 40, '1X40', 1500, 4500000, 6000000),
      (10.0, 15.0, 'Hitachi ZX120/130/135 10-15T', 'ZX120 / 130 / 135', ARRAY['ZX120-5B','ZX120-6','ZX130L-5B','ZX130K-6','ZX135US-5B','ZX135US-6','ZX135USK-5B','ZX135USK-6'], 60, 'RORO', 7000, 4000000, 9000000),
      (20.0, 23.0, 'Hitachi ZX200/210/225 20-23T', 'ZX200 / 210 / 225', ARRAY['ZX200-5B','ZX200-6','ZX200LC-6','ZX200X-5B','ZX210LC-6','ZX210K-5B','ZX210K-6','ZX210H-6','ZX210LCH-5B','ZX225US-5B','ZX225US-6','ZX225USR-5B','ZX225USR-6','ZX225USRK-5B'], 95, 'RORO', 11000, 5000000, 16000000),
      (24.0, 26.0, 'Hitachi ZX240/250 24-26T', 'ZX240 / 250', ARRAY['ZX240-6','ZX240LC-6','ZX250K-6'], 110, 'RORO', 12500, 6000000, 19000000),
      (28.0, 33.0, 'Hitachi ZX300/330 28-33T', 'ZX300 / 330', ARRAY['ZX300LC-6N','ZX300-6A','ZX330-5B','ZX330-6'], 122, 'RORO', 13500, 7000000, 30000000),
      (35.0, 38.0, 'Hitachi ZX350 35-38T', 'ZX350', ARRAY['ZX350-5B','ZX350H-5B','ZX350H-6','ZX350LC-6N','ZX350K-6','ZX350LCK-6'], 140, 'RORO', 15500, 8000000, 32000000),
      (44.0, 50.0, 'Hitachi ZX470/490 44-50T', 'ZX470 / ZX490', ARRAY['ZX490H-6','ZX490LCH-5A'], 155, 'RORO', 23000, 12000000, 38000000)
  ) AS t(ton_min, ton_max, name, base_model, model_patterns, m3, shipment, ocean_usd, gastos_pto_cop, flete_cop)
)
INSERT INTO public.automatic_cost_rules (
  name,
  tonnage_min,
  tonnage_max,
  tonnage_label,
  equipment,
  model_patterns,
  m3,
  shipment_method,
  ocean_usd,
  gastos_pto_cop,
  flete_cop,
  active
)
SELECT
  name,
  ton_min,
  ton_max,
  CONCAT(ton_min::text, ' - ', ton_max::text, ' TON'),
  base_model,
  model_patterns,
  m3,
  shipment,
  ocean_usd,
  gastos_pto_cop,
  flete_cop,
  TRUE
FROM rules;

