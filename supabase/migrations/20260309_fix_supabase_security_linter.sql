-- =====================================================
-- Corrección de advertencias del Security Linter de Supabase
-- =====================================================
-- 1. Security Definer View (0010): vistas pasan a security invoker
-- 2. RLS Disabled in Public (0013): habilitar RLS en tablas públicas
-- Sin alterar lógica, funcionalidad ni flujo de datos.
-- =====================================================

-- -----------------------------------------------------------
-- PARTE 1: Vistas con SECURITY INVOKER (lint 0010)
-- Las vistas se ejecutan con permisos del usuario que consulta,
-- respetando RLS de las tablas subyacentes.
-- -----------------------------------------------------------

ALTER VIEW IF EXISTS public.v_files_by_module SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_auctions_complete SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_management_consolidado SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_unified_purchases SET (security_invoker = true);

-- -----------------------------------------------------------
-- PARTE 2: Habilitar RLS en tablas públicas (lint 0013)
-- Políticas por tabla: mismo patrón que el resto del proyecto
-- (usuarios autenticados según uso actual de la app).
-- -----------------------------------------------------------

-- equipments
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view equipments"
  ON public.equipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert equipments"
  ON public.equipments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update equipments"
  ON public.equipments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete equipments"
  ON public.equipments FOR DELETE TO authenticated USING (true);

-- change_logs
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view change_logs"
  ON public.change_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert change_logs"
  ON public.change_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update change_logs"
  ON public.change_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete change_logs"
  ON public.change_logs FOR DELETE TO authenticated USING (true);

-- spec_types
ALTER TABLE public.spec_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view spec_types"
  ON public.spec_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert spec_types"
  ON public.spec_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update spec_types"
  ON public.spec_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete spec_types"
  ON public.spec_types FOR DELETE TO authenticated USING (true);

-- notification_rules
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view notification_rules"
  ON public.notification_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert notification_rules"
  ON public.notification_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update notification_rules"
  ON public.notification_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete notification_rules"
  ON public.notification_rules FOR DELETE TO authenticated USING (true);

-- machine_movements
ALTER TABLE public.machine_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view machine_movements"
  ON public.machine_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert machine_movements"
  ON public.machine_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update machine_movements"
  ON public.machine_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete machine_movements"
  ON public.machine_movements FOR DELETE TO authenticated USING (true);

-- pvp_history
ALTER TABLE public.pvp_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pvp_history"
  ON public.pvp_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pvp_history"
  ON public.pvp_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pvp_history"
  ON public.pvp_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete pvp_history"
  ON public.pvp_history FOR DELETE TO authenticated USING (true);

-- service_records
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view service_records"
  ON public.service_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert service_records"
  ON public.service_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update service_records"
  ON public.service_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete service_records"
  ON public.service_records FOR DELETE TO authenticated USING (true);

-- auction_price_history
ALTER TABLE public.auction_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view auction_price_history"
  ON public.auction_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert auction_price_history"
  ON public.auction_price_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update auction_price_history"
  ON public.auction_price_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete auction_price_history"
  ON public.auction_price_history FOR DELETE TO authenticated USING (true);

-- machine_spec_defaults
ALTER TABLE public.machine_spec_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view machine_spec_defaults"
  ON public.machine_spec_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert machine_spec_defaults"
  ON public.machine_spec_defaults FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update machine_spec_defaults"
  ON public.machine_spec_defaults FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete machine_spec_defaults"
  ON public.machine_spec_defaults FOR DELETE TO authenticated USING (true);

-- auction_notification_sent
ALTER TABLE public.auction_notification_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view auction_notification_sent"
  ON public.auction_notification_sent FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert auction_notification_sent"
  ON public.auction_notification_sent FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update auction_notification_sent"
  ON public.auction_notification_sent FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete auction_notification_sent"
  ON public.auction_notification_sent FOR DELETE TO authenticated USING (true);

-- model_specifications
ALTER TABLE public.model_specifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view model_specifications"
  ON public.model_specifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert model_specifications"
  ON public.model_specifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update model_specifications"
  ON public.model_specifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete model_specifications"
  ON public.model_specifications FOR DELETE TO authenticated USING (true);

-- automatic_cost_rules
ALTER TABLE public.automatic_cost_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view automatic_cost_rules"
  ON public.automatic_cost_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert automatic_cost_rules"
  ON public.automatic_cost_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update automatic_cost_rules"
  ON public.automatic_cost_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete automatic_cost_rules"
  ON public.automatic_cost_rules FOR DELETE TO authenticated USING (true);

-- qa_case34_backup (tabla de respaldo; políticas completas para no romper uso si existe)
ALTER TABLE public.qa_case34_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view qa_case34_backup"
  ON public.qa_case34_backup FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert qa_case34_backup"
  ON public.qa_case34_backup FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update qa_case34_backup"
  ON public.qa_case34_backup FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete qa_case34_backup"
  ON public.qa_case34_backup FOR DELETE TO authenticated USING (true);
