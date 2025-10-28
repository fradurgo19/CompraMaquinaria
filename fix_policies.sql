-- Arreglar políticas de machine_files
DROP POLICY IF EXISTS "Users can view files of their machines" ON machine_files;
DROP POLICY IF EXISTS "Users can upload files" ON machine_files;
DROP POLICY IF EXISTS "Users can delete their uploaded files" ON machine_files;

-- Crear nuevas políticas simplificadas
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
