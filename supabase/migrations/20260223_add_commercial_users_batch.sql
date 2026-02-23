-- Migration: Add 24 commercial users (rol comerciales, misma funcionalidad que comercial/comercial2/comercial3)
-- Created: 2026-02-23
-- Description: Crea usuarios comerciales con correos indicados; contraseña inicial: comercial123
-- No modifica lógica, permisos ni flujo de datos; solo inserta en auth.users y users_profile.

-- =====================================================
-- USUARIOS COMERCIALES (rol: comerciales)
-- =====================================================
-- Mismo rol y permisos que comercial@, comercial2@, comercial3@partequipos.com

-- 1. Julian David Ramirez - dramirez@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000020',
  'dramirez@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dramirez@partequipos.com' OR id = '20000000-0000-0000-0000-000000000020');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000020',
  'Julian David Ramirez',
  'dramirez@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Julian David Ramirez', email = 'dramirez@partequipos.com', updated_at = NOW();

-- 2. Juan Manuel Guerrero - jguerrero@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000021',
  'jguerrero@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'jguerrero@partequipos.com' OR id = '20000000-0000-0000-0000-000000000021');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000021',
  'Juan Manuel Guerrero',
  'jguerrero@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Juan Manuel Guerrero', email = 'jguerrero@partequipos.com', updated_at = NOW();

-- 3. German Blanco - gblanco@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000022',
  'gblanco@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gblanco@partequipos.com' OR id = '20000000-0000-0000-0000-000000000022');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000022',
  'German Blanco',
  'gblanco@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'German Blanco', email = 'gblanco@partequipos.com', updated_at = NOW();

-- 4. Claudia Echeverri - cecheverri@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000023',
  'cecheverri@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'cecheverri@partequipos.com' OR id = '20000000-0000-0000-0000-000000000023');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000023',
  'Claudia Echeverri',
  'cecheverri@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Claudia Echeverri', email = 'cecheverri@partequipos.com', updated_at = NOW();

-- 5. Paola Arabia - parabia@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000024',
  'parabia@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'parabia@partequipos.com' OR id = '20000000-0000-0000-0000-000000000024');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000024',
  'Paola Arabia',
  'parabia@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Paola Arabia', email = 'parabia@partequipos.com', updated_at = NOW();

-- 6. Franciso Javier Gacha - fgacha@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000025',
  'fgacha@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'fgacha@partequipos.com' OR id = '20000000-0000-0000-0000-000000000025');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000025',
  'Franciso Javier Gacha',
  'fgacha@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Franciso Javier Gacha', email = 'fgacha@partequipos.com', updated_at = NOW();

-- 7. Luis Anchundia - lanchundia@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000026',
  'lanchundia@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'lanchundia@partequipos.com' OR id = '20000000-0000-0000-0000-000000000026');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000026',
  'Luis Anchundia',
  'lanchundia@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Luis Anchundia', email = 'lanchundia@partequipos.com', updated_at = NOW();

-- 8. Luisa Fernanda Cruz - lcruz@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000027',
  'lcruz@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'lcruz@partequipos.com' OR id = '20000000-0000-0000-0000-000000000027');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000027',
  'Luisa Fernanda Cruz',
  'lcruz@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Luisa Fernanda Cruz', email = 'lcruz@partequipos.com', updated_at = NOW();

-- 9. Yuliana Reina - yreina@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000028',
  'yreina@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'yreina@partequipos.com' OR id = '20000000-0000-0000-0000-000000000028');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000028',
  'Yuliana Reina',
  'yreina@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Yuliana Reina', email = 'yreina@partequipos.com', updated_at = NOW();

-- 10. Alexander Ussa Sanchez - jussa@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000029',
  'jussa@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'jussa@partequipos.com' OR id = '20000000-0000-0000-0000-000000000029');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000029',
  'Alexander Ussa Sanchez',
  'jussa@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Alexander Ussa Sanchez', email = 'jussa@partequipos.com', updated_at = NOW();

-- 11. Claudia Bogota - cbogota@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000030',
  'cbogota@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'cbogota@partequipos.com' OR id = '20000000-0000-0000-0000-000000000030');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000030',
  'Claudia Bogota',
  'cbogota@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Claudia Bogota', email = 'cbogota@partequipos.com', updated_at = NOW();

-- 12. Felipe Moreno - fmoreno@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000031',
  'fmoreno@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'fmoreno@partequipos.com' OR id = '20000000-0000-0000-0000-000000000031');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000031',
  'Felipe Moreno',
  'fmoreno@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Felipe Moreno', email = 'fmoreno@partequipos.com', updated_at = NOW();

-- 13. Edgar Bustos - ebustos@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000032',
  'ebustos@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ebustos@partequipos.com' OR id = '20000000-0000-0000-0000-000000000032');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000032',
  'Edgar Bustos',
  'ebustos@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Edgar Bustos', email = 'ebustos@partequipos.com', updated_at = NOW();

-- 14. Diana Paola Ardila - dardila@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000033',
  'dardila@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dardila@partequipos.com' OR id = '20000000-0000-0000-0000-000000000033');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000033',
  'Diana Paola Ardila',
  'dardila@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Diana Paola Ardila', email = 'dardila@partequipos.com', updated_at = NOW();

-- 15. Eliana Rojas Estupiñan - erojas@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000034',
  'erojas@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'erojas@partequipos.com' OR id = '20000000-0000-0000-0000-000000000034');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000034',
  'Eliana Rojas Estupiñan',
  'erojas@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Eliana Rojas Estupiñan', email = 'erojas@partequipos.com', updated_at = NOW();

-- 16. Juan Suarez - jsuarez@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000035',
  'jsuarez@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'jsuarez@partequipos.com' OR id = '20000000-0000-0000-0000-000000000035');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000035',
  'Juan Suarez',
  'jsuarez@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Juan Suarez', email = 'jsuarez@partequipos.com', updated_at = NOW();

-- 17. Fabian Corrales - fcorrales@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000036',
  'fcorrales@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'fcorrales@partequipos.com' OR id = '20000000-0000-0000-0000-000000000036');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000036',
  'Fabian Corrales',
  'fcorrales@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Fabian Corrales', email = 'fcorrales@partequipos.com', updated_at = NOW();

-- 18. Leonardo Cardona - lcardona@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000037',
  'lcardona@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'lcardona@partequipos.com' OR id = '20000000-0000-0000-0000-000000000037');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000037',
  'Leonardo Cardona',
  'lcardona@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Leonardo Cardona', email = 'lcardona@partequipos.com', updated_at = NOW();

-- 19. Fabiola Hurtado - fhurtado@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000038',
  'fhurtado@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'fhurtado@partequipos.com' OR id = '20000000-0000-0000-0000-000000000038');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000038',
  'Fabiola Hurtado',
  'fhurtado@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Fabiola Hurtado', email = 'fhurtado@partequipos.com', updated_at = NOW();

-- 20. Efrain Rua - erua@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000039',
  'erua@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'erua@partequipos.com' OR id = '20000000-0000-0000-0000-000000000039');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000039',
  'Efrain Rua',
  'erua@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Efrain Rua', email = 'erua@partequipos.com', updated_at = NOW();

-- 21. Yudi Ochoa - yochoa@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000040',
  'yochoa@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'yochoa@partequipos.com' OR id = '20000000-0000-0000-0000-000000000040');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000040',
  'Yudi Ochoa',
  'yochoa@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Yudi Ochoa', email = 'yochoa@partequipos.com', updated_at = NOW();

-- 22. Ludwing Martinez - lmartinez@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000041',
  'lmartinez@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'lmartinez@partequipos.com' OR id = '20000000-0000-0000-0000-000000000041');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000041',
  'Ludwing Martinez',
  'lmartinez@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Ludwing Martinez', email = 'lmartinez@partequipos.com', updated_at = NOW();

-- 23. Juliana Florez - jflorez@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000042',
  'jflorez@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'jflorez@partequipos.com' OR id = '20000000-0000-0000-0000-000000000042');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000042',
  'Juliana Florez',
  'jflorez@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Juliana Florez', email = 'jflorez@partequipos.com', updated_at = NOW();

-- 24. Ricardo Rene Garcia - rgarcia@partequipos.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT
  '20000000-0000-0000-0000-000000000043',
  'rgarcia@partequipos.com',
  crypt('comercial123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'rgarcia@partequipos.com' OR id = '20000000-0000-0000-0000-000000000043');

INSERT INTO public.users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '20000000-0000-0000-0000-000000000043',
  'Ricardo Rene Garcia',
  'rgarcia@partequipos.com',
  'comerciales',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET role = 'comerciales', full_name = 'Ricardo Rene Garcia', email = 'rgarcia@partequipos.com', updated_at = NOW();

-- =====================================================
-- VERIFICACIÓN (opcional; ejecutar en SQL Editor para confirmar)
-- =====================================================
-- SELECT id, full_name, email, role FROM public.users_profile WHERE role = 'comerciales' ORDER BY email;
