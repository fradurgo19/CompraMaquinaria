-- Migration: Add RLS policies for preselections table
-- Fecha: 2025-12-07
-- Descripción: Crear políticas RLS para preselections permitiendo que Sebastian edite/elimine cualquier registro

-- Habilitar RLS en preselections si no está habilitado
ALTER TABLE preselections ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si hay alguna
DROP POLICY IF EXISTS "Sebastian and Gerencia can view preselections" ON preselections;
DROP POLICY IF EXISTS "Sebastian can create preselections" ON preselections;
DROP POLICY IF EXISTS "Sebastian can update preselections" ON preselections;
DROP POLICY IF EXISTS "Sebastian can delete preselections" ON preselections;

-- Política: Sebastian y Gerencia pueden ver todas las preselecciones
CREATE POLICY "Sebastian and Gerencia can view preselections"
  ON preselections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profile 
      WHERE id = auth.uid() 
      AND role IN ('sebastian', 'gerencia', 'admin')
    )
  );

-- Política: Sebastian puede crear preselecciones
CREATE POLICY "Sebastian can create preselections"
  ON preselections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_profile 
      WHERE id = auth.uid() 
      AND role IN ('sebastian', 'admin')
    )
  );

-- Política: Sebastian puede actualizar CUALQUIER preselección (no solo las creadas por él)
CREATE POLICY "Sebastian can update any preselection"
  ON preselections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profile 
      WHERE id = auth.uid() 
      AND role IN ('sebastian', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_profile 
      WHERE id = auth.uid() 
      AND role IN ('sebastian', 'admin')
    )
  );

-- Política: Sebastian puede eliminar CUALQUIER preselección (no solo las creadas por él)
CREATE POLICY "Sebastian can delete any preselection"
  ON preselections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profile 
      WHERE id = auth.uid() 
      AND role IN ('sebastian', 'admin')
    )
  );

