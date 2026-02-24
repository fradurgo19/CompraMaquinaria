-- Permitir valor N/A en especificaciones de modelo (Línea Húmeda, Hoja Topadora)
-- La UI ya ofrece N/A; los CHECK actuales solo permitían SI/NO.

ALTER TABLE public.model_specifications
  DROP CONSTRAINT IF EXISTS model_specifications_wet_line_check;

ALTER TABLE public.model_specifications
  DROP CONSTRAINT IF EXISTS model_specifications_dozer_blade_check;

ALTER TABLE public.model_specifications
  ADD CONSTRAINT model_specifications_wet_line_check
  CHECK (wet_line IS NULL OR wet_line IN ('SI', 'NO', 'N/A'));

ALTER TABLE public.model_specifications
  ADD CONSTRAINT model_specifications_dozer_blade_check
  CHECK (dozer_blade IS NULL OR dozer_blade IN ('SI', 'NO', 'N/A'));

COMMENT ON COLUMN public.model_specifications.wet_line IS 'Línea húmeda: SI, NO o N/A';
COMMENT ON COLUMN public.model_specifications.dozer_blade IS 'Hoja topadora: SI, NO o N/A';
