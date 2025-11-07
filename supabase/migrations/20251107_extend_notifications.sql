-- Extender tabla notifications para Sistema Multinivel

-- Agregar columnas para módulos origen y destino
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS module_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS module_target VARCHAR(50),
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS action_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS action_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Actualizar constraint de type para incluir más opciones
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('urgent', 'warning', 'info', 'success'));

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_notifications_module_target ON notifications(module_target);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Comentarios
COMMENT ON COLUMN notifications.module_source IS 'Modulo que genera la alerta';
COMMENT ON COLUMN notifications.module_target IS 'Modulo destinatario de la alerta';
COMMENT ON COLUMN notifications.priority IS '1=Baja, 2=Media, 3=Alta, 4=Critica';
COMMENT ON COLUMN notifications.metadata IS 'Datos adicionales en formato JSON';
COMMENT ON COLUMN notifications.expires_at IS 'Fecha de expiracion automatica';

