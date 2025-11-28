-- Tabla para rastrear notificaciones de subastas enviadas
-- Evita enviar notificaciones duplicadas

CREATE TABLE IF NOT EXISTS auction_notification_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('1_DAY_BEFORE', '3_HOURS_BEFORE')),
  sent_at timestamptz DEFAULT NOW(),
  email_message_id text,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(auction_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_auction_notification_sent_auction_id ON auction_notification_sent(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_notification_sent_type ON auction_notification_sent(notification_type);
CREATE INDEX IF NOT EXISTS idx_auction_notification_sent_sent_at ON auction_notification_sent(sent_at);

COMMENT ON TABLE auction_notification_sent IS 'Rastrea las notificaciones de subastas enviadas por correo para evitar duplicados';
COMMENT ON COLUMN auction_notification_sent.notification_type IS 'Tipo de notificación: 1_DAY_BEFORE (1 día antes) o 3_HOURS_BEFORE (3 horas antes)';

