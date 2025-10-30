-- Agregar rol 'servicio' y usuario servicio@partequipos.com
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_role_check;
ALTER TABLE users_profile
  ADD CONSTRAINT users_profile_role_check CHECK (role IN (
    'sebastian','eliana','gerencia','admin','importaciones','logistica','comerciales','jefe_comercial','servicio'
  ));

-- Crear usuario de servicio
-- NOTA: Ajustar UUIDs si es necesario; en dev local suele bastar con el INSERT directo
INSERT INTO auth.users (email, encrypted_password)
SELECT 'servicio@partequipos.com', crypt('servicio123', gen_salt('bf'))
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email='servicio@partequipos.com');

-- Vincular perfil si no existe
INSERT INTO users_profile (id, full_name, email, role)
SELECT u.id, 'Usuario Servicio', u.email, 'servicio'
FROM auth.users u
LEFT JOIN users_profile p ON p.id = u.id
WHERE u.email='servicio@partequipos.com' AND p.id IS NULL;


