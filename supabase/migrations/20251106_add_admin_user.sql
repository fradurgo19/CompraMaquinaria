-- Agregar rol 'admin' al CHECK constraint de users_profile si no existe
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_role_check;
ALTER TABLE users_profile ADD CONSTRAINT users_profile_role_check 
  CHECK (role IN ('sebastian', 'eliana', 'gerencia', 'admin', 'importaciones', 'logistica', 'servicio', 'comerciales', 'jefe_comercial'));

-- Crear usuario admin en auth.users
-- Password: admin123 (hasheado con bcrypt)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '10000000-0000-0000-0000-000000000010',
  'admin@partequipos.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  encrypted_password = crypt('admin123', gen_salt('bf')),
  updated_at = NOW();

-- Crear perfil de admin en users_profile
INSERT INTO users_profile (id, full_name, email, role, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000010',
  'Administrador',
  'admin@partequipos.com',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  updated_at = NOW();

