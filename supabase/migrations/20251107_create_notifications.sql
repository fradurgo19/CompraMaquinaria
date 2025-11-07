-- Sistema de Notificaciones Internas
-- Alertas entre módulos para eventos importantes

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Origen y destino
  module_source VARCHAR(50) NOT NULL,        -- Módulo que genera la alerta
  module_target VARCHAR(50) NOT NULL,        -- Módulo destinatario
  
  -- Tipo y prioridad
  type VARCHAR(20) NOT NULL CHECK (type IN ('urgent', 'warning', 'info', 'success')),
  priority INTEGER DEFAULT 1,                 -- 1=Baja, 2=Media, 3=Alta, 4=Crítica
  
  -- Contenido
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  
  -- Referencia al registro relacionado
  related_record_id UUID,
  related_table VARCHAR(50),
  
  -- Datos adicionales en JSON (flexible para cualquier metadata)
  metadata JSONB,
  
  -- Estado
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  read_by UUID,
  
  -- Usuarios destinatarios (múltiples usuarios pueden recibir la misma alerta)
  target_user_ids UUID[],
  target_roles VARCHAR(50)[],                -- Ej: ['admin', 'gerencia']
  
  -- Acciones disponibles
  action_type VARCHAR(50),                   -- 'view_record', 'edit_record', 'approve', etc.
  action_url VARCHAR(255),
  
  -- Vigencia
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,       -- Auto-eliminar después de esta fecha
  created_by UUID,
  
  -- Índices para consultas rápidas
  CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users_profile(id) ON DELETE SET NULL,
  CONSTRAINT fk_read_by FOREIGN KEY (read_by) REFERENCES users_profile(id) ON DELETE SET NULL
);

-- Índices para optimizar consultas
CREATE INDEX idx_notifications_target ON notifications(module_target);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at);
CREATE INDEX idx_notifications_target_roles ON notifications USING GIN(target_roles);

-- Función para auto-eliminar notificaciones expiradas (ejecutar diariamente via cron)
CREATE OR REPLACE FUNCTION delete_expired_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON TABLE notifications IS 'Sistema de alertas internas entre módulos';
COMMENT ON COLUMN notifications.module_source IS 'Módulo que genera la alerta (auctions, purchases, etc.)';
COMMENT ON COLUMN notifications.module_target IS 'Módulo destinatario de la alerta';
COMMENT ON COLUMN notifications.type IS 'Tipo visual: urgent (rojo), warning (amarillo), info (azul), success (verde)';
COMMENT ON COLUMN notifications.priority IS 'Prioridad numérica: 1=Baja, 2=Media, 3=Alta, 4=Crítica';
COMMENT ON COLUMN notifications.metadata IS 'Datos adicionales en formato JSON para flexibilidad';
COMMENT ON COLUMN notifications.target_roles IS 'Roles que pueden ver esta notificación';
COMMENT ON COLUMN notifications.expires_at IS 'Fecha de expiración automática de la alerta';

