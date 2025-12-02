-- Crear tabla para reservas de equipos
CREATE TABLE IF NOT EXISTS equipment_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
  commercial_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  documents jsonb DEFAULT '[]'::jsonb, -- Array de documentos adjuntos
  comments text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_equipment_reservations_equipment_id ON equipment_reservations(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_reservations_commercial_user_id ON equipment_reservations(commercial_user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_reservations_status ON equipment_reservations(status);

-- Comentarios
COMMENT ON TABLE equipment_reservations IS 'Reservas de equipos realizadas por usuarios comerciales';
COMMENT ON COLUMN equipment_reservations.status IS 'Estado de la reserva: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN equipment_reservations.documents IS 'Array JSON con información de documentos adjuntos';

-- Habilitar RLS
ALTER TABLE equipment_reservations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view equipment reservations"
  ON equipment_reservations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Commercial users can create reservations"
  ON equipment_reservations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Commercial manager can update reservations"
  ON equipment_reservations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Agregar columna de estado de reserva a equipments si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'equipments' AND column_name = 'reservation_status'
  ) THEN
    ALTER TABLE equipments ADD COLUMN reservation_status text DEFAULT 'AVAILABLE' CHECK (reservation_status IN ('AVAILABLE', 'RESERVED', 'SOLD'));
  END IF;
END $$;

-- Comentario en la columna
COMMENT ON COLUMN equipments.reservation_status IS 'Estado de reserva del equipo: AVAILABLE, RESERVED, SOLD';

