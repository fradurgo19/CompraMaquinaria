-- Tabla para almacenar movimientos de máquinas en logística
CREATE TABLE IF NOT EXISTS machine_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  movement_description TEXT NOT NULL,
  movement_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users_profile(id)
);

-- Comentarios
COMMENT ON TABLE machine_movements IS 'Movimientos y trazabilidad de máquinas en logística';
COMMENT ON COLUMN machine_movements.purchase_id IS 'Referencia a la compra/máquina';
COMMENT ON COLUMN machine_movements.movement_description IS 'Descripción del movimiento realizado';
COMMENT ON COLUMN machine_movements.movement_date IS 'Fecha en que se realizó el movimiento';
COMMENT ON COLUMN machine_movements.created_by IS 'Usuario que registró el movimiento';

-- Índices
CREATE INDEX IF NOT EXISTS idx_machine_movements_purchase_id ON machine_movements(purchase_id);
CREATE INDEX IF NOT EXISTS idx_machine_movements_movement_date ON machine_movements(movement_date);

