-- Actualizar nombres visibles en el frontend (users_profile.full_name)
-- Sebastian Donado, Eliana Melgarejo, Lina Gonzalez

BEGIN;

UPDATE users_profile
SET full_name = 'Sebastian Donado'
WHERE email = 'sebastian@partequipos.com';

UPDATE users_profile
SET full_name = 'Eliana Melgarejo'
WHERE email = 'eliana@partequipos.com';

UPDATE users_profile
SET full_name = 'Lina Gonzalez'
WHERE email = 'jefecomercial@partequipos.com';

COMMIT;

-- Verificación rápida
-- SELECT email, full_name FROM users_profile WHERE email IN (
--   'sebastian@partequipos.com',
--   'eliana@partequipos.com',
--   'jefecomercial@partequipos.com'
-- );


