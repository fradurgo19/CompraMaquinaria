-- Añadir las reglas de notificación implementadas en código para que aparezcan en el módulo Reglas de Notificación:
-- 1. Preselección creada -> aviso inmediato a pcano@partequipos.com
-- 2. Subasta por cumplirse 1 día antes (hora Colombia) -> sdonado@partequiposusa.com
-- 3. Subasta por cumplirse 3 horas antes (hora Colombia) -> sdonado@partequiposusa.com

-- Regla 6: Preselección creada - pendiente por aprobar
INSERT INTO public.notification_rules (
  rule_code, name, description,
  module_source, module_target,
  trigger_event, trigger_condition,
  notification_type, notification_priority,
  notification_title_template, notification_message_template,
  target_roles, target_users, action_type, action_url_template,
  check_frequency_minutes, expires_in_days, is_active
) VALUES (
  'preselection_created',
  'Preselección creada - pendiente por aprobar',
  'Cuando se crea un registro en Preselección, notifica inmediatamente a pcano@partequipos.com con modelo y número de serie. Al hacer clic en Ver se abre el registro en Preselección.',
  'preselection',
  'preselection',
  'preselection_created',
  '{}'::jsonb,
  'warning',
  3,
  'Preselección pendiente por aprobar',
  'Tiene una preselección pendiente por aprobar. Número de serie: {serial}.',
  NULL,
  COALESCE((SELECT array_agg(up.id) FROM users_profile up LEFT JOIN auth.users au ON up.id = au.id WHERE LOWER(TRIM(COALESCE(au.email, up.email, ''))) = 'pcano@partequipos.com'), '{}'::uuid[]),
  'view_preselection',
  '/preselection?preselectionId={recordId}',
  0,
  7,
  true
) ON CONFLICT (rule_code) DO NOTHING;

-- Regla 7: Subasta por cumplirse - 1 día antes (hora Colombia)
INSERT INTO public.notification_rules (
  rule_code, name, description,
  module_source, module_target,
  trigger_event, trigger_condition,
  notification_type, notification_priority,
  notification_title_template, notification_message_template,
  target_roles, target_users, action_type, action_url_template,
  check_frequency_minutes, expires_in_days, is_active
) VALUES (
  'auction_1_day_before',
  'Subasta por cumplirse - 1 día antes (hora Colombia)',
  'Notifica a sdonado@partequiposusa.com un día antes de que se cumpla la subasta según hora y fecha de Colombia. Al hacer clic en Ver se abre el registro en Subastas.',
  'auctions',
  'auctions',
  'auction_reminder',
  '{"type": "1_DAY_BEFORE"}'::jsonb,
  'info',
  2,
  'Subasta por cumplirse en 1 día (hora Colombia)',
  'Subasta próxima: {model} - {serial}. Hora Colombia: {colombia_time}. 1 subasta.',
  NULL,
  COALESCE((SELECT array_agg(up.id) FROM users_profile up LEFT JOIN auth.users au ON up.id = au.id WHERE LOWER(TRIM(COALESCE(au.email, up.email, ''))) = 'sdonado@partequiposusa.com'), '{}'::uuid[]),
  'view_auctions',
  '/auctions?auctionId={recordId}',
  15,
  2,
  true
) ON CONFLICT (rule_code) DO NOTHING;

-- Regla 8: Subasta por cumplirse - 3 horas antes (hora Colombia)
INSERT INTO public.notification_rules (
  rule_code, name, description,
  module_source, module_target,
  trigger_event, trigger_condition,
  notification_type, notification_priority,
  notification_title_template, notification_message_template,
  target_roles, target_users, action_type, action_url_template,
  check_frequency_minutes, expires_in_days, is_active
) VALUES (
  'auction_3_hours_before',
  'Subasta por cumplirse - 3 horas antes (hora Colombia)',
  'Notifica a sdonado@partequiposusa.com tres horas antes de que se cumpla la subasta según hora y fecha de Colombia. Al hacer clic en Ver se abre el registro en Subastas.',
  'auctions',
  'auctions',
  'auction_reminder',
  '{"type": "3_HOURS_BEFORE"}'::jsonb,
  'warning',
  3,
  'Subasta por cumplirse en 3 horas (hora Colombia)',
  'Subasta próxima: {model} - {serial}. Hora Colombia: {colombia_time}. 1 subasta.',
  NULL,
  COALESCE((SELECT array_agg(up.id) FROM users_profile up LEFT JOIN auth.users au ON up.id = au.id WHERE LOWER(TRIM(COALESCE(au.email, up.email, ''))) = 'sdonado@partequiposusa.com'), '{}'::uuid[]),
  'view_auctions',
  '/auctions?auctionId={recordId}',
  15,
  2,
  true
) ON CONFLICT (rule_code) DO NOTHING;
