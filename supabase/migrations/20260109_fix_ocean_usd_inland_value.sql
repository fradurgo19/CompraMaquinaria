-- Migration: Corregir campo inland (OCEAN USD) que está usando valores incorrectos
-- Created: 2026-01-09
-- Description: Verificar y corregir registros donde inland tiene el mismo valor que precio_fob (FOB ORIGEN), fob_value o fob_usd
-- El campo inland debe contener el valor de OCEAN USD de las reglas automáticas, NO el valor de FOB ORIGEN/USD

-- Primero, verificar si hay registros con el problema
-- (Este es solo para diagnóstico, no modifica datos)

-- Crear función para verificar y corregir valores incorrectos de inland
CREATE OR REPLACE FUNCTION fix_inland_ocean_usd_values()
RETURNS TABLE(
  purchase_id uuid,
  machine_id uuid,
  current_inland numeric,
  fob_value numeric,
  fob_usd numeric,
  corrected_inland numeric,
  action_taken text
) AS $$
DECLARE
  v_purchase RECORD;
  v_ocean_usd_from_rule numeric;
  v_rule_id uuid;
BEGIN
  -- Buscar purchases donde inland tiene el mismo valor que precio_fob (FOB ORIGEN), fob_value o fob_usd
  -- Esto indica que se asignó incorrectamente el valor de FOB ORIGEN/USD a inland
  -- precio_fob = exw_value_formatted + fob_expenses + disassembly_load_value
  FOR v_purchase IN
    SELECT 
      p.id as purchase_id,
      p.machine_id,
      p.inland,
      p.fob_value,
      p.fob_usd,
      -- Calcular precio_fob (FOB ORIGEN) igual que en management.js
      CASE 
        WHEN p.incoterm = 'CIF' THEN COALESCE(p.cif_usd, 0)
        ELSE (
          COALESCE(NULLIF(p.exw_value_formatted, '')::numeric, 0) + 
          COALESCE(NULLIF(p.fob_expenses, '')::numeric, 0) + 
          COALESCE(p.disassembly_load_value, 0)
        )
      END as precio_fob,
      m.model,
      m.brand,
      p.shipment_type_v2 as shipment
    FROM purchases p
    JOIN machines m ON p.machine_id = m.id
    WHERE 
      p.inland IS NOT NULL 
      AND p.inland > 0
      AND (
        -- Inland tiene el mismo valor que precio_fob (FOB ORIGEN) - con tolerancia de 0.01
        ABS(p.inland - (
          CASE 
            WHEN p.incoterm = 'CIF' THEN COALESCE(p.cif_usd, 0)
            ELSE (
              COALESCE(NULLIF(p.exw_value_formatted, '')::numeric, 0) + 
              COALESCE(NULLIF(p.fob_expenses, '')::numeric, 0) + 
              COALESCE(p.disassembly_load_value, 0)
            )
          END
        )) < 0.01
        OR 
        -- Inland tiene el mismo valor que fob_value (con tolerancia de 0.01)
        ABS(p.inland - COALESCE(p.fob_value, 0)) < 0.01
        OR 
        -- Inland tiene el mismo valor que fob_usd (con tolerancia de 0.01)
        (p.fob_usd IS NOT NULL AND ABS(p.inland - p.fob_usd) < 0.01)
      )
  LOOP
    -- Intentar encontrar una regla automática para este modelo
    SELECT 
      r.ocean_usd,
      r.id
    INTO 
      v_ocean_usd_from_rule,
      v_rule_id
    FROM automatic_cost_rules r
    WHERE 
      r.active = true
      AND (
        -- Buscar por modelo exacto
        (r.model_patterns IS NOT NULL AND v_purchase.model = ANY(r.model_patterns))
        OR
        -- Buscar por patrón de modelo
        (r.model_patterns IS NOT NULL AND EXISTS (
          SELECT 1 FROM unnest(r.model_patterns) AS pattern
          WHERE v_purchase.model LIKE '%' || pattern || '%'
        ))
      )
      AND (
        -- Buscar por marca
        (r.brand IS NULL OR r.brand = v_purchase.brand)
      )
      AND (
        -- Buscar por shipment type (la columna se llama shipment_method, no shipment)
        (r.shipment_method IS NULL OR r.shipment_method = v_purchase.shipment)
      )
    ORDER BY 
      -- Priorizar reglas más específicas (con marca y shipment_method)
      CASE WHEN r.brand IS NOT NULL AND r.shipment_method IS NOT NULL THEN 1 ELSE 2 END,
      r.updated_at DESC
    LIMIT 1;
    
    -- Si se encontró una regla, usar el valor de ocean_usd
    IF v_ocean_usd_from_rule IS NOT NULL AND v_ocean_usd_from_rule > 0 THEN
      -- Actualizar el purchase con el valor correcto de OCEAN USD
      UPDATE purchases
      SET 
        inland = v_ocean_usd_from_rule,
        inland_verified = false,
        updated_at = NOW()
      WHERE id = v_purchase.purchase_id;
      
      -- Retornar información sobre la corrección
      RETURN QUERY SELECT
        v_purchase.purchase_id,
        v_purchase.machine_id,
        v_purchase.inland as current_inland,
        v_purchase.fob_value,
        v_purchase.fob_usd,
        v_ocean_usd_from_rule as corrected_inland,
        'CORREGIDO: Se actualizó inland con el valor de OCEAN USD de la regla automática (ID: ' || v_rule_id || '). Valor anterior: ' || v_purchase.inland || ', Valor nuevo: ' || v_ocean_usd_from_rule as action_taken;
    ELSE
      -- No se encontró regla, establecer inland a NULL para que el usuario lo configure manualmente
      UPDATE purchases
      SET 
        inland = NULL,
        inland_verified = false,
        updated_at = NOW()
      WHERE id = v_purchase.purchase_id;
      
      -- Retornar información sobre la corrección
      RETURN QUERY SELECT
        v_purchase.purchase_id,
        v_purchase.machine_id,
        v_purchase.inland as current_inland,
        v_purchase.fob_value,
        v_purchase.fob_usd,
        NULL::numeric as corrected_inland,
        'CORREGIDO: Se estableció inland a NULL porque no se encontró regla automática para modelo "' || v_purchase.model || '" (marca: ' || COALESCE(v_purchase.brand, 'NULL') || ', shipment: ' || COALESCE(v_purchase.shipment, 'NULL') || '). Debe configurarse manualmente o aplicar regla automática.' as action_taken;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fix_inland_ocean_usd_values() IS 'Función para corregir valores incorrectos de inland (OCEAN USD) que tienen el mismo valor que FOB ORIGEN (precio_fob), fob_value o fob_usd. Busca reglas automáticas y actualiza con el valor correcto de OCEAN USD.';

-- Ejecutar la función para corregir los valores
-- NOTA: Esta función se puede ejecutar manualmente cuando sea necesario
-- SELECT * FROM fix_inland_ocean_usd_values();

-- También crear una función de validación que se puede usar en triggers o verificaciones periódicas
CREATE OR REPLACE FUNCTION validate_inland_not_equal_fob()
RETURNS TRIGGER AS $$
DECLARE
  v_precio_fob numeric;
BEGIN
  -- Validar que inland no tenga el mismo valor que precio_fob (FOB ORIGEN), fob_value o fob_usd
  IF NEW.inland IS NOT NULL AND NEW.inland > 0 THEN
    -- Calcular precio_fob (FOB ORIGEN) igual que en management.js
    v_precio_fob := CASE 
      WHEN NEW.incoterm = 'CIF' THEN COALESCE(NEW.cif_usd, 0)
      ELSE (
        COALESCE(NULLIF(NEW.exw_value_formatted, '')::numeric, 0) + 
        COALESCE(NULLIF(NEW.fob_expenses, '')::numeric, 0) + 
        COALESCE(NEW.disassembly_load_value, 0)
      )
    END;
    
    IF (
      (v_precio_fob IS NOT NULL AND ABS(NEW.inland - v_precio_fob) < 0.01)
      OR
      (NEW.fob_value IS NOT NULL AND ABS(NEW.inland - NEW.fob_value) < 0.01)
      OR
      (NEW.fob_usd IS NOT NULL AND ABS(NEW.inland - NEW.fob_usd) < 0.01)
    ) THEN
      RAISE WARNING 'El campo inland (OCEAN USD) tiene el mismo valor que FOB ORIGEN/USD. Esto es incorrecto. Inland debe contener el valor de OCEAN USD de las reglas automáticas, no el valor de FOB ORIGEN/USD.';
      -- NO bloquear la inserción/actualización, solo advertir
      -- El usuario puede corregir esto aplicando una regla automática
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_inland_not_equal_fob() IS 'Función de validación que advierte cuando inland tiene el mismo valor que FOB ORIGEN (precio_fob), fob_value o fob_usd, lo cual es incorrecto.';

-- Crear trigger para validar en tiempo real (solo advierte, no bloquea)
DROP TRIGGER IF EXISTS trigger_validate_inland_not_equal_fob ON purchases;
CREATE TRIGGER trigger_validate_inland_not_equal_fob
  BEFORE INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION validate_inland_not_equal_fob();

COMMENT ON TRIGGER trigger_validate_inland_not_equal_fob ON purchases IS 'Trigger que valida que inland no tenga el mismo valor que FOB ORIGEN/USD. Solo advierte, no bloquea la operación.';
