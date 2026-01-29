-- Regla: Cuando en Compras se modifican PRECIO COMPRA, VALOR+BP, GASTOS+LAVADO o DESENSAMBLAJE+CARGUE,
-- notificar a los usuarios del módulo Pagos. Al hacer clic en Ver se abre Pagos y se resalta el registro en amarillo.

INSERT INTO public.notification_rules (
  rule_code, name, description,
  module_source, module_target,
  trigger_event, trigger_condition,
  notification_type, notification_priority,
  notification_title_template, notification_message_template,
  target_roles, target_users, action_type, action_url_template,
  check_frequency_minutes, expires_in_days, is_active
) VALUES (
  'purchase_price_fields_changed',
  'Compras: campos de precio actualizados → Pagos',
  'Cuando un usuario del módulo Compras agrega o modifica PRECIO COMPRA, VALOR+BP, GASTOS+LAVADO o DESENSAMBLAJE+CARGUE, se notifica a los usuarios del módulo Pagos. La notificación muestra MQ, modelo y serie. Al hacer clic en Ver se abre Pagos y el registro se resalta en amarillo.',
  'purchases',
  'pagos',
  'purchase_price_fields_changed',
  '{}'::jsonb,
  'info',
  2,
  'Compras: campos de precio actualizados',
  'Se actualizaron valores en Compras. MQ: {mq}, Modelo: {model}, Serie: {serial}. Al hacer clic en Ver se abre el registro en Pagos.',
  ARRAY['pagos'],
  NULL,
  'view_pagos',
  '/pagos?purchaseId={recordId}',
  0,
  7,
  true
) ON CONFLICT (rule_code) DO NOTHING;
