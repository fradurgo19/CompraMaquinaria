-- Actualizar template de mensaje: retirar "Modelo: {model}" de preselection_created
UPDATE public.notification_rules
SET notification_message_template = 'Tiene una preselección pendiente por aprobar. Número de serie: {serial}.'
WHERE rule_code = 'preselection_created';
