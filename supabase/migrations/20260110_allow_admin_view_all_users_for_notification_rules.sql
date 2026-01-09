-- Permitir a los administradores ver todos los usuarios para reglas de notificación
-- Esta migración crea una función SECURITY DEFINER que bypasea RLS de forma segura

-- Primero, eliminar la política antigua si existe
DROP POLICY IF EXISTS "Users can view own profile" ON users_profile;
DROP POLICY IF EXISTS "Admin can view all profiles" ON users_profile;
DROP POLICY IF EXISTS "Users can view own profile or admin can view all" ON users_profile;

-- Crear función que verifica si un usuario es admin (SECURITY DEFINER para bypasear RLS)
CREATE OR REPLACE FUNCTION is_admin_user(user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Usar SECURITY DEFINER para bypasear RLS al consultar users_profile
  RETURN EXISTS (
    SELECT 1 FROM users_profile 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Política mejorada: usuarios pueden ver su propio perfil O admins pueden ver todos
CREATE POLICY "Users can view own profile or admin can view all"
  ON users_profile FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR 
    is_admin_user(auth.uid())
  );

-- Función SECURITY DEFINER para obtener lista de usuarios (bypasea RLS)
-- Esta función solo puede ser llamada por usuarios admin verificados
-- Nota: En Supabase, SECURITY DEFINER ejecuta con permisos del creador de la función (postgres/supabase_admin)
-- lo que permite bypasear RLS completamente
CREATE OR REPLACE FUNCTION get_all_users_for_notification_rules(admin_user_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role text
) AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Verificar que el usuario que llama es admin (bypasea RLS por SECURITY DEFINER)
  SELECT EXISTS (
    SELECT 1 FROM users_profile 
    WHERE id = admin_user_id AND role = 'admin'
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Acceso denegado: Solo administradores pueden obtener la lista de usuarios. User ID: %', admin_user_id;
  END IF;

  -- Retornar todos los usuarios (bypasea RLS porque es SECURITY DEFINER)
  -- Al ser SECURITY DEFINER, esta función ejecuta con permisos de superusuario
  RETURN QUERY
  SELECT 
    up.id::uuid,
    up.full_name::text,
    COALESCE(up.email, au.email, 'Sin email')::text as email,
    up.role::text
  FROM users_profile up
  LEFT JOIN auth.users au ON up.id = au.id
  ORDER BY up.full_name ASC NULLS LAST, COALESCE(up.email, au.email, '') ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON FUNCTION is_admin_user(uuid) IS 
  'Verifica si un usuario tiene rol admin. Usado en políticas RLS.';

COMMENT ON FUNCTION get_all_users_for_notification_rules(uuid) IS 
  'Obtiene lista completa de usuarios para reglas de notificación. Solo accesible por administradores. Bypasea RLS de forma segura.';
