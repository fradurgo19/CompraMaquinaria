-- =====================================================
-- Migración: Sistema de Archivos para COMPRAS NUEVOS
-- Fecha: 2025-11-11
-- Descripción: Tabla de archivos para new_purchases (separada de machine_files)
-- =====================================================

-- 1. CREAR TABLA new_purchase_files
CREATE TABLE IF NOT EXISTS new_purchase_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  new_purchase_id UUID NOT NULL REFERENCES new_purchases(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('FOTO', 'DOCUMENTO')),
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scope TEXT DEFAULT 'COMPRAS_NUEVOS' CHECK (
    scope IN ('COMPRAS_NUEVOS', 'IMPORTACIONES', 'LOGISTICA', 'EQUIPOS', 'SERVICIO')
  )
);

-- 2. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_new_purchase_files_new_purchase_id ON new_purchase_files(new_purchase_id);
CREATE INDEX IF NOT EXISTS idx_new_purchase_files_file_type ON new_purchase_files(file_type);
CREATE INDEX IF NOT EXISTS idx_new_purchase_files_uploaded_by ON new_purchase_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_new_purchase_files_scope ON new_purchase_files(scope);

-- 3. TRIGGER PARA updated_at
CREATE OR REPLACE FUNCTION update_new_purchase_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_new_purchase_files_updated_at
  BEFORE UPDATE ON new_purchase_files
  FOR EACH ROW
  EXECUTE FUNCTION update_new_purchase_files_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE new_purchase_files ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios autenticados pueden ver todos los archivos
CREATE POLICY "Authenticated users can view all files"
  ON new_purchase_files FOR SELECT
  TO authenticated
  USING (true);

-- Política: Usuarios autenticados pueden subir archivos
CREATE POLICY "Authenticated users can upload files"
  ON new_purchase_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: Solo el creador puede eliminar sus archivos
CREATE POLICY "Authenticated users can delete their files"
  ON new_purchase_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- 5. COMENTARIOS
COMMENT ON TABLE new_purchase_files IS 'Archivos (fotos y documentos) de compras nuevas - sistema paralelo a machine_files';
COMMENT ON COLUMN new_purchase_files.new_purchase_id IS 'Referencia a la compra nueva (new_purchases)';
COMMENT ON COLUMN new_purchase_files.scope IS 'Módulo donde se subió: COMPRAS_NUEVOS, IMPORTACIONES, LOGISTICA, EQUIPOS, SERVICIO';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

