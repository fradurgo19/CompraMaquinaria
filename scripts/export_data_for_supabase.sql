-- =====================================================
-- Script para Exportar Datos de Local a Supabase
-- =====================================================
-- Este script exporta datos de las tablas:
-- 1. notification_rules (reglas adicionales)
-- 2. auction_price_history (histórico de precios de subastas)
-- 3. pvp_history (histórico de PVP)
--
-- Uso:
-- 1. Ejecutar este script en la base de datos LOCAL
-- 2. Copiar los resultados y ejecutarlos en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. EXPORTAR REGLAS DE NOTIFICACIÓN ADICIONALES
-- =====================================================
-- Nota: Las 5 reglas básicas ya están en Supabase
-- Este script exporta reglas adicionales que puedas haber creado

SELECT 
  'INSERT INTO public.notification_rules (' ||
  'rule_code, name, description, ' ||
  'module_source, module_target, ' ||
  'trigger_event, trigger_condition, ' ||
  'notification_type, notification_priority, ' ||
  'notification_title_template, notification_message_template, ' ||
  'target_roles, target_users, ' ||
  'action_type, action_url_template, ' ||
  'is_active, check_frequency_minutes, expires_in_days' ||
  ') VALUES (' ||
  quote_literal(rule_code) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(module_source) || ', ' ||
  quote_literal(module_target) || ', ' ||
  quote_literal(trigger_event) || ', ' ||
  quote_literal(trigger_condition::text) || '::jsonb, ' ||
  quote_literal(notification_type) || ', ' ||
  notification_priority || ', ' ||
  quote_literal(notification_title_template) || ', ' ||
  quote_literal(notification_message_template) || ', ' ||
  quote_literal(ARRAY_TO_STRING(target_roles, ',')) || '::VARCHAR(50)[], ' ||
  COALESCE(quote_literal(ARRAY_TO_STRING(target_users::text[], ',')), 'NULL') || ', ' ||
  COALESCE(quote_literal(action_type), 'NULL') || ', ' ||
  COALESCE(quote_literal(action_url_template), 'NULL') || ', ' ||
  is_active || ', ' ||
  check_frequency_minutes || ', ' ||
  expires_in_days ||
  ') ON CONFLICT (rule_code) DO UPDATE SET ' ||
  'name = EXCLUDED.name, ' ||
  'description = EXCLUDED.description, ' ||
  'module_source = EXCLUDED.module_source, ' ||
  'module_target = EXCLUDED.module_target, ' ||
  'trigger_event = EXCLUDED.trigger_event, ' ||
  'trigger_condition = EXCLUDED.trigger_condition, ' ||
  'notification_type = EXCLUDED.notification_type, ' ||
  'notification_priority = EXCLUDED.notification_priority, ' ||
  'notification_title_template = EXCLUDED.notification_title_template, ' ||
  'notification_message_template = EXCLUDED.notification_message_template, ' ||
  'target_roles = EXCLUDED.target_roles, ' ||
  'target_users = EXCLUDED.target_users, ' ||
  'action_type = EXCLUDED.action_type, ' ||
  'action_url_template = EXCLUDED.action_url_template, ' ||
  'is_active = EXCLUDED.is_active, ' ||
  'check_frequency_minutes = EXCLUDED.check_frequency_minutes, ' ||
  'expires_in_days = EXCLUDED.expires_in_days, ' ||
  'updated_at = NOW();' as insert_statement
FROM notification_rules
WHERE rule_code NOT IN (
  'auction_won_no_purchase',
  'purchase_missing_invoice',
  'nationalized_ready_service',
  'staging_completed',
  'logistics_no_movement'
)
ORDER BY rule_code;

-- =====================================================
-- 2. EXPORTAR HISTÓRICO DE PRECIOS DE SUBASTAS
-- =====================================================

SELECT 
  'INSERT INTO public.auction_price_history (' ||
  'model, brand, serial, year, hours, ' ||
  'precio_comprado, fecha_subasta, proveedor, lot_number' ||
  ') VALUES (' ||
  quote_literal(model) || ', ' ||
  COALESCE(quote_literal(brand), 'NULL') || ', ' ||
  COALESCE(quote_literal(serial), 'NULL') || ', ' ||
  COALESCE(year::text, 'NULL') || ', ' ||
  COALESCE(hours::text, 'NULL') || ', ' ||
  COALESCE(precio_comprado::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(fecha_subasta::text), 'NULL') || '::DATE, ' ||
  COALESCE(quote_literal(proveedor), 'NULL') || ', ' ||
  COALESCE(quote_literal(lot_number), 'NULL') ||
  ');' as insert_statement
FROM auction_price_history
ORDER BY imported_at DESC;

-- =====================================================
-- 3. EXPORTAR HISTÓRICO DE PVP
-- =====================================================

SELECT 
  'INSERT INTO public.pvp_history (' ||
  'provee, modelo, serie, anio, hour, ' ||
  'precio, inland, cif_usd, cif, gastos_pto, ' ||
  'flete, trasld, rptos, proyectado, pvp_est, fecha' ||
  ') VALUES (' ||
  COALESCE(quote_literal(provee), 'NULL') || ', ' ||
  quote_literal(modelo) || ', ' ||
  COALESCE(quote_literal(serie), 'NULL') || ', ' ||
  COALESCE(anio::text, 'NULL') || ', ' ||
  COALESCE(hour::text, 'NULL') || ', ' ||
  COALESCE(precio::text, 'NULL') || ', ' ||
  COALESCE(inland::text, 'NULL') || ', ' ||
  COALESCE(cif_usd::text, 'NULL') || ', ' ||
  COALESCE(cif::text, 'NULL') || ', ' ||
  COALESCE(gastos_pto::text, 'NULL') || ', ' ||
  COALESCE(flete::text, 'NULL') || ', ' ||
  COALESCE(trasld::text, 'NULL') || ', ' ||
  COALESCE(rptos::text, 'NULL') || ', ' ||
  COALESCE(proyectado::text, 'NULL') || ', ' ||
  COALESCE(pvp_est::text, 'NULL') || ', ' ||
  COALESCE(fecha::text, 'NULL') ||
  ');' as insert_statement
FROM pvp_history
ORDER BY imported_at DESC;

-- =====================================================
-- RESUMEN DE DATOS A EXPORTAR
-- =====================================================

SELECT 
  'notification_rules' as tabla,
  COUNT(*) as total_registros
FROM notification_rules
WHERE rule_code NOT IN (
  'auction_won_no_purchase',
  'purchase_missing_invoice',
  'nationalized_ready_service',
  'staging_completed',
  'logistics_no_movement'
)
UNION ALL
SELECT 
  'auction_price_history' as tabla,
  COUNT(*) as total_registros
FROM auction_price_history
UNION ALL
SELECT 
  'pvp_history' as tabla,
  COUNT(*) as total_registros
FROM pvp_history;
