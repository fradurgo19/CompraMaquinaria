-- Eliminar columna reservation_status de equipments (ya se usa estado general)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'equipments'
      AND column_name = 'reservation_status'
  ) THEN
    -- Quitar constraint si existe
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipments_reservation_status_check') THEN
      ALTER TABLE equipments DROP CONSTRAINT equipments_reservation_status_check;
    END IF;

    ALTER TABLE equipments
      DROP COLUMN IF EXISTS reservation_status;
  END IF;
END$$;


