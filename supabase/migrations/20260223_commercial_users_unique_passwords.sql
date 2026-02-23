-- Migration: Set unique passwords for commercial users (comercial + 3 digits)
-- Created: 2026-02-23
-- Description: Actualiza contraseña en auth.users para cada comercial con patrón comercial### único.
-- Referencia: ver comentario al final para asignación email -> contraseña.

-- 1. Claudia Bogota - comercial001
UPDATE auth.users
SET encrypted_password = crypt('comercial001', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000030';

-- 2. Claudia Echeverri - comercial002
UPDATE auth.users
SET encrypted_password = crypt('comercial002', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000023';

-- 3. Usuario Comercial (comercial@) - comercial003
UPDATE auth.users
SET encrypted_password = crypt('comercial003', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000001';

-- 4. Usuario Comercial 2 - comercial004
UPDATE auth.users
SET encrypted_password = crypt('comercial004', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000003';

-- 5. Usuario Comercial 3 - comercial005
UPDATE auth.users
SET encrypted_password = crypt('comercial005', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000004';

-- 6. Diana Paola Ardila - comercial006
UPDATE auth.users
SET encrypted_password = crypt('comercial006', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000033';

-- 7. Julian David Ramirez - comercial007
UPDATE auth.users
SET encrypted_password = crypt('comercial007', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000020';

-- 8. Edgar Bustos - comercial008
UPDATE auth.users
SET encrypted_password = crypt('comercial008', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000032';

-- 9. Eliana Rojas Estupiñan - comercial009
UPDATE auth.users
SET encrypted_password = crypt('comercial009', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000034';

-- 10. Efrain Rua - comercial010
UPDATE auth.users
SET encrypted_password = crypt('comercial010', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000039';

-- 11. Fabian Corrales - comercial011
UPDATE auth.users
SET encrypted_password = crypt('comercial011', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000036';

-- 12. Franciso Javier Gacha - comercial012
UPDATE auth.users
SET encrypted_password = crypt('comercial012', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000025';

-- 13. Fabiola Hurtado - comercial013
UPDATE auth.users
SET encrypted_password = crypt('comercial013', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000038';

-- 14. Felipe Moreno - comercial014
UPDATE auth.users
SET encrypted_password = crypt('comercial014', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000031';

-- 15. German Blanco - comercial015
UPDATE auth.users
SET encrypted_password = crypt('comercial015', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000022';

-- 16. Juliana Florez - comercial016
UPDATE auth.users
SET encrypted_password = crypt('comercial016', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000042';

-- 17. Juan Manuel Guerrero - comercial017
UPDATE auth.users
SET encrypted_password = crypt('comercial017', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000021';

-- 18. Juan Suarez - comercial018
UPDATE auth.users
SET encrypted_password = crypt('comercial018', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000035';

-- 19. Alexander Ussa Sanchez - comercial019
UPDATE auth.users
SET encrypted_password = crypt('comercial019', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000029';

-- 20. Luis Anchundia - comercial020
UPDATE auth.users
SET encrypted_password = crypt('comercial020', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000026';

-- 21. Leonardo Cardona - comercial021
UPDATE auth.users
SET encrypted_password = crypt('comercial021', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000037';

-- 22. Luisa Fernanda Cruz - comercial022
UPDATE auth.users
SET encrypted_password = crypt('comercial022', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000027';

-- 23. Ludwing Martinez - comercial023
UPDATE auth.users
SET encrypted_password = crypt('comercial023', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000041';

-- 24. Paola Arabia - comercial024
UPDATE auth.users
SET encrypted_password = crypt('comercial024', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000024';

-- 25. Ricardo Rene Garcia - comercial025
UPDATE auth.users
SET encrypted_password = crypt('comercial025', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000043';

-- 26. Yudi Ochoa - comercial026
UPDATE auth.users
SET encrypted_password = crypt('comercial026', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000040';

-- 27. Yuliana Reina - comercial027
UPDATE auth.users
SET encrypted_password = crypt('comercial027', gen_salt('bf')), updated_at = NOW()
WHERE id = '20000000-0000-0000-0000-000000000028';

-- =====================================================
-- REFERENCIA: Correo -> Contraseña (comercial###)
-- =====================================================
-- cbogota@partequipos.com       -> comercial001
-- cecheverri@partequipos.com    -> comercial002
-- comercial@partequipos.com     -> comercial003
-- comercial2@partequipos.com    -> comercial004
-- comercial3@partequipos.com     -> comercial005
-- dardila@partequipos.com       -> comercial006
-- dramirez@partequipos.com      -> comercial007
-- ebustos@partequipos.com       -> comercial008
-- erojas@partequipos.com        -> comercial009
-- erua@partequipos.com          -> comercial010
-- fcorrales@partequipos.com     -> comercial011
-- fgacha@partequipos.com        -> comercial012
-- fhurtado@partequipos.com      -> comercial013
-- fmoreno@partequipos.com       -> comercial014
-- gblanco@partequipos.com       -> comercial015
-- jflorez@partequipos.com       -> comercial016
-- jguerrero@partequipos.com     -> comercial017
-- jsuarez@partequipos.com       -> comercial018
-- jussa@partequipos.com         -> comercial019
-- lanchundia@partequipos.com    -> comercial020
-- lcardona@partequipos.com      -> comercial021
-- lcruz@partequipos.com         -> comercial022
-- lmartinez@partequipos.com     -> comercial023
-- parabia@partequipos.com       -> comercial024
-- rgarcia@partequipos.com       -> comercial025
-- yochoa@partequipos.com        -> comercial026
-- yreina@partequipos.com        -> comercial027
