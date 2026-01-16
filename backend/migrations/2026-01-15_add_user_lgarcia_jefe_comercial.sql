-- Crear usuario Laura Garcia (jefe_comercial) si no existe
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lgarcia@partequipos.com';

  IF v_user_id IS NULL THEN
    -- Crear usuario en auth.users con contraseña temporal (cámbiela tras el primer login)
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      raw_user_meta_data,
      created_at,
      updated_at,
      aud,
      role,
      encrypted_password,
      email_confirmed_at
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'lgarcia@partequipos.com',
      '{}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated',
      crypt('lgarcia123', gen_salt('bf')),
      now()
    );
  END IF;

  -- Crear/actualizar perfil en users_profile
  INSERT INTO public.users_profile (id, full_name, email, role)
  VALUES (v_user_id, 'Laura Garcia', 'lgarcia@partequipos.com', 'jefe_comercial')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role;
END $$;
