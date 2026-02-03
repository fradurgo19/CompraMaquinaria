-- Actualizar target_users de la regla preselection_created para asegurar que pcano@partequipos.com reciba notificaciones
-- (la migración original puede haber insertado {} si el usuario no existía al momento de ejecutarse)
UPDATE public.notification_rules
SET target_users = COALESCE(
  (SELECT array_agg(up.id)
   FROM public.users_profile up
   LEFT JOIN auth.users au ON up.id = au.id
   WHERE LOWER(TRIM(COALESCE(au.email, up.email, ''))) = 'pcano@partequipos.com'),
  '{}'::uuid[]
)
WHERE rule_code = 'preselection_created';
