-- =====================================================
-- Migración: Permitir que sebastian vea todas las subastas
-- Fecha: 2025-01-12
-- Descripción: Actualiza política RLS para que sebastian pueda ver todas las subastas, no solo las que creó
-- =====================================================

-- ====== ACTUALIZAR POLICIES PARA AUCTIONS ======
-- Permitir que sebastian vea todas las subastas (no solo las que creó)
DROP POLICY IF EXISTS "Role based access to auctions" ON auctions;
CREATE POLICY "Role based access to auctions"
  ON auctions FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('sebastian', 'gerencia', 'admin')
  );

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

