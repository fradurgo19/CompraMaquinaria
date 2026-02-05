-- Modificar la regla "Preselección creada - pendiente por aprobar" para que dispare
-- cuando se modifica el campo HORAS en un registro de Preselección (Campo Modificado).
-- Destinatario y mensaje se mantienen (pcano@partequipos.com, modelo y número de serie).

UPDATE notification_rules
SET
  trigger_event = 'field_changed',
  trigger_condition = '{"field_name": "hours"}'::jsonb,
  name = 'Preselección - HORAS modificadas',
  description = 'Cuando el usuario de preselección modifica el campo HORAS en un registro, notifica a pcano@partequipos.com con modelo y número de serie. Al hacer clic en Ver se abre el registro en Preselección.',
  notification_message_template = 'Tiene una preselección pendiente por aprobar. Modelo: {model}. Número de serie: {serial}.'
WHERE rule_code = 'preselection_created';
