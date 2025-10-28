-- Migration: Create files table for machine documents and photos
-- Created: 2025-10-23
-- Description: Stores metadata for machine photos and documents

CREATE TABLE IF NOT EXISTS machine_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('FOTO', 'DOCUMENTO')),
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_machine_files_machine_id ON machine_files(machine_id);
CREATE INDEX idx_machine_files_file_type ON machine_files(file_type);
CREATE INDEX idx_machine_files_uploaded_by ON machine_files(uploaded_by);

-- Enable RLS
ALTER TABLE machine_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Políticas RLS simplificadas para desarrollo local
-- El control de permisos se hace en el backend con JWT

CREATE POLICY "Authenticated users can view all files"
  ON machine_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload files"
  ON machine_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete their files"
  ON machine_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_machine_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_machine_files_updated_at
  BEFORE UPDATE ON machine_files
  FOR EACH ROW
  EXECUTE FUNCTION update_machine_files_updated_at();

-- Comentarios
COMMENT ON TABLE machine_files IS 'Almacena metadata de archivos (fotos y documentos) de máquinas';
COMMENT ON COLUMN machine_files.file_type IS 'Tipo: FOTO o DOCUMENTO';
COMMENT ON COLUMN machine_files.file_path IS 'Ruta relativa en el servidor';
