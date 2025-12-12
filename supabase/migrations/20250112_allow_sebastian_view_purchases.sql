-- =====================================================
-- Migración: Permitir que sebastian vea compras
-- Fecha: 2025-01-12
-- Descripción: Actualiza políticas RLS para permitir que el rol 'sebastian' pueda ver compras
-- =====================================================

-- ====== ACTUALIZAR POLICIES PARA PURCHASES ======
-- Permitir que sebastian vea compras (además de eliana, gerencia, admin)
DROP POLICY IF EXISTS "Role based access to purchases" ON purchases;
CREATE POLICY "Role based access to purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('eliana', 'gerencia', 'admin', 'sebastian'));

-- ====== ACTUALIZAR POLICIES PARA COST_ITEMS ======
-- Permitir que sebastian vea cost_items (además de eliana, gerencia, admin)
DROP POLICY IF EXISTS "Role based access to cost_items" ON cost_items;
CREATE POLICY "Role based access to cost_items"
  ON cost_items FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('eliana', 'gerencia', 'admin', 'sebastian'));

-- ====== ACTUALIZAR POLICIES PARA SHIPPING ======
-- Permitir que sebastian vea shipping (además de eliana, gerencia, admin)
DROP POLICY IF EXISTS "Role based access to shipping" ON shipping;
CREATE POLICY "Role based access to shipping"
  ON shipping FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('eliana', 'gerencia', 'admin', 'sebastian'));

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
