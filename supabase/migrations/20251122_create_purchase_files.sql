-- Migration: Create purchase_files table for private files in purchases module
-- Created: 2025-11-22
-- Description: Sistema de carpetas privadas para módulo de compras con subcarpetas: LAVADO, SERIALES, DOCUMENTOS DEFINITIVOS, CARGUE

-- Crear tabla purchase_files
CREATE TABLE IF NOT EXISTS purchase_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('FOTO', 'DOCUMENTO')),
  folder VARCHAR(50) NOT NULL CHECK (folder IN ('LAVADO', 'SERIALES', 'DOCUMENTOS DEFINITIVOS', 'CARGUE')),
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_files_purchase_id ON purchase_files(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_files_folder ON purchase_files(folder);
CREATE INDEX IF NOT EXISTS idx_purchase_files_file_type ON purchase_files(file_type);
CREATE INDEX IF NOT EXISTS idx_purchase_files_uploaded_by ON purchase_files(uploaded_by);

-- Enable RLS
ALTER TABLE purchase_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Solo usuarios de compras (eliana, gerencia, admin) pueden ver/editar
CREATE POLICY "Only purchases users can view purchase_files"
  ON purchase_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.id = auth.uid()
      AND up.role IN ('eliana', 'gerencia', 'admin')
    )
  );

CREATE POLICY "Only purchases users can upload purchase_files"
  ON purchase_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.id = auth.uid()
      AND up.role IN ('eliana', 'gerencia', 'admin')
    )
  );

CREATE POLICY "Only purchases users can delete purchase_files"
  ON purchase_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.id = auth.uid()
      AND up.role IN ('eliana', 'gerencia', 'admin')
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_purchase_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_purchase_files_updated_at
  BEFORE UPDATE ON purchase_files
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_files_updated_at();

-- Comentarios
COMMENT ON TABLE purchase_files IS 'Archivos privados del módulo de compras organizados en carpetas: LAVADO, SERIALES, DOCUMENTOS DEFINITIVOS, CARGUE';
COMMENT ON COLUMN purchase_files.folder IS 'Carpeta donde se almacena el archivo: LAVADO, SERIALES, DOCUMENTOS DEFINITIVOS, CARGUE';
COMMENT ON COLUMN purchase_files.file_type IS 'Tipo de archivo: FOTO o DOCUMENTO';

