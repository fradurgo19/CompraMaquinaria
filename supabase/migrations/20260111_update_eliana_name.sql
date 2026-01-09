-- Actualizar nombre de usuario Eliana Rodríguez a Eliana Melgarejo
-- Usuario: eliana@partequipos.com

UPDATE public.users_profile
SET 
  full_name = 'Eliana Melgarejo',
  updated_at = NOW()
WHERE email = 'eliana@partequipos.com';

-- Verificar que se actualizó correctamente
SELECT 
  u.email,
  p.full_name,
  p.role,
  p.updated_at
FROM auth.users u
LEFT JOIN public.users_profile p ON u.id = p.id
WHERE u.email = 'eliana@partequipos.com';
