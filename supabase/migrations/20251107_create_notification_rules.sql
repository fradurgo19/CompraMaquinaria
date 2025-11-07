-- Tabla de Reglas de Notificaciones Parametrizables
-- Permite configurar triggers sin modificar código

CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificación
  rule_code VARCHAR(100) UNIQUE NOT NULL,    -- Código único (ej: 'auction_won_no_purchase')
  name VARCHAR(200) NOT NULL,                 -- Nombre descriptivo
  description TEXT,                           -- Descripción de qué hace la regla
  
  -- Módulos
  module_source VARCHAR(50) NOT NULL,        -- Módulo que genera el evento
  module_target VARCHAR(50) NOT NULL,        -- Módulo destinatario
  
  -- Trigger
  trigger_event VARCHAR(100) NOT NULL,       -- Evento que dispara (ej: 'status_change', 'date_missing')
  trigger_condition JSONB,                   -- Condiciones en JSON (ej: {"status": "GANADA", "days_elapsed": 1})
  
  -- Notificación a generar
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('urgent', 'warning', 'info', 'success')),
  notification_priority INTEGER DEFAULT 1,
  notification_title_template VARCHAR(200) NOT NULL,    -- Ej: "⚠️ Subasta ganada sin compra: {mq}"
  notification_message_template TEXT NOT NULL,          -- Ej: "MQ {mq} ganada hace {days} días sin registro"
  
  -- Destinatarios
  target_roles VARCHAR(50)[],                -- Roles que reciben la notificación
  target_users UUID[],                       -- Usuarios específicos (opcional)
  
  -- Acción
  action_type VARCHAR(50),
  action_url_template VARCHAR(255),          -- Ej: "/purchases?mq={mq}"
  
  -- Configuración
  is_active BOOLEAN DEFAULT true,
  check_frequency_minutes INTEGER DEFAULT 60, -- Cada cuántos minutos verificar (para cron)
  expires_in_days INTEGER DEFAULT 7,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users_profile(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX idx_rules_active ON notification_rules(is_active);
CREATE INDEX idx_rules_trigger_event ON notification_rules(trigger_event);
CREATE INDEX idx_rules_module_source ON notification_rules(module_source);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_notification_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_rules_timestamp
BEFORE UPDATE ON notification_rules
FOR EACH ROW
EXECUTE FUNCTION update_notification_rules_updated_at();

-- Insertar reglas de ejemplo
INSERT INTO notification_rules (
  rule_code, name, description,
  module_source, module_target,
  trigger_event, trigger_condition,
  notification_type, notification_priority,
  notification_title_template, notification_message_template,
  target_roles, action_type, action_url_template,
  check_frequency_minutes, expires_in_days, is_active
) VALUES
-- Regla 1: Subasta ganada sin registro de compra
(
  'auction_won_no_purchase',
  'Subasta ganada sin compra',
  'Alerta cuando una subasta marcada como GANADA no tiene registro de compra después de 1 día',
  'auctions', 'purchases',
  'status_change',
  '{"status": "GANADA", "days_without_purchase": 1}'::jsonb,
  'urgent', 4,
  '⚠️ Subasta ganada sin registro de compra',
  'La máquina {mq} fue ganada hace {days} día(s) pero no tiene registro de compra. Por favor, cree el registro en el módulo de Compras.',
  ARRAY['eliana', 'gerencia', 'admin'],
  'create_purchase', '/purchases',
  60, 30, true
),
-- Regla 2: Compra sin factura
(
  'purchase_missing_invoice',
  'Compra sin fecha de factura',
  'Alerta cuando una compra no tiene fecha de factura después de 3 días',
  'purchases', 'purchases',
  'invoice_missing',
  '{"days_without_invoice": 3}'::jsonb,
  'warning', 3,
  '📄 Compra sin fecha de factura',
  'La máquina {mq} no tiene fecha de factura desde hace {days} días. Por favor, actualice la información.',
  ARRAY['eliana', 'importaciones', 'gerencia', 'admin'],
  'edit_purchase', '/purchases',
  120, 15, true
),
-- Regla 3: Máquina nacionalizada lista para servicio
(
  'nationalized_ready_service',
  'Máquina nacionalizada',
  'Alerta cuando una máquina es nacionalizada y está lista para alistamiento',
  'importations', 'service',
  'nationalization_complete',
  '{}'::jsonb,
  'info', 2,
  '📦 Máquina nacionalizada lista para servicio',
  'La máquina {mq} ha sido nacionalizada y está lista para iniciar el proceso de alistamiento.',
  ARRAY['servicio', 'gerencia', 'admin'],
  'view_service', '/service',
  60, 7, true
),
-- Regla 4: Alistamiento completado
(
  'staging_completed',
  'Alistamiento completado',
  'Alerta cuando una máquina completa el alistamiento y está lista para venta',
  'service', 'equipments',
  'staging_complete',
  '{}'::jsonb,
  'success', 2,
  '✅ Máquina lista para comercialización',
  'La máquina {mq} ha completado el proceso de alistamiento. PVP Estimado: ${pvp_est}',
  ARRAY['comerciales', 'jefe_comercial', 'gerencia', 'admin'],
  'view_equipment', '/equipments',
  60, 7, true
),
-- Regla 5: Máquina sin movimiento logístico
(
  'logistics_no_movement',
  'Máquina sin movimiento',
  'Alerta cuando una máquina nacionalizada no tiene movimientos después de 2 días',
  'logistics', 'logistics',
  'no_movement',
  '{"days_without_movement": 2}'::jsonb,
  'warning', 3,
  '🚚 Máquina sin movimiento logístico',
  'La máquina {mq} ha sido nacionalizada hace {days} días pero no tiene registros de movimiento.',
  ARRAY['logistica', 'gerencia', 'admin'],
  'edit_movement', '/logistics',
  120, 10, true
);

-- Comentarios
COMMENT ON TABLE notification_rules IS 'Reglas parametrizables para generar notificaciones automáticas';
COMMENT ON COLUMN notification_rules.rule_code IS 'Código único de la regla para referencia programática';
COMMENT ON COLUMN notification_rules.trigger_condition IS 'Condiciones JSON que deben cumplirse para disparar la regla';
COMMENT ON COLUMN notification_rules.notification_title_template IS 'Template del título con placeholders {variable}';
COMMENT ON COLUMN notification_rules.check_frequency_minutes IS 'Frecuencia en minutos para verificar esta regla (cron)';

