BEGIN;

ALTER TABLE IF EXISTS public.administrador
  ADD COLUMN IF NOT EXISTS tipo_identificacion character varying(20),
  ADD COLUMN IF NOT EXISTS numero_identificacion character varying(20),
  ADD COLUMN IF NOT EXISTS email character varying(200);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'role_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.role_enum AS ENUM ('administrador', 'estudiante', 'profesor');
  END IF;
END $$;

ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'administrador';
ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'estudiante';
ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'profesor';

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  nombre character varying(100) NOT NULL,
  apellido character varying(100) NOT NULL,
  email character varying(200) NOT NULL,
  role public.role_enum NOT NULL,
  approved boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.administrador a
SET
  tipo_identificacion = COALESCE(NULLIF(a.tipo_identificacion, ''), 'CC'),
  numero_identificacion = COALESCE(
    NULLIF(a.numero_identificacion, ''),
    LEFT(REPLACE(a.id::text, '-', ''), 20)
  ),
  email = COALESCE(
    NULLIF(a.email, ''),
    u.email,
    'admin+' || LEFT(a.id::text, 8) || '@example.com'
  )
FROM auth.users u
WHERE u.id = a.id;

CREATE OR REPLACE FUNCTION public.sync_profile_from_admin() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  resolved_email text;
BEGIN
  resolved_email := COALESCE(
    NULLIF(NEW.email, ''),
    (SELECT u.email FROM auth.users u WHERE u.id = NEW.id),
    'admin+' || LEFT(NEW.id::text, 8) || '@example.com'
  );

  INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
  VALUES (
    NEW.id,
    NEW.nombres,
    NEW.apellidos,
    resolved_email,
    'administrador',
    COALESCE(NEW.aprobado, false)
  )
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        approved = EXCLUDED.approved;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile_link() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_tipo_identificacion text;
  v_numero_identificacion text;
  v_localpart text;
BEGIN
  IF to_regclass('public.estudiantes') IS NOT NULL THEN
    UPDATE public.estudiantes
      SET auth_user_id = NEW.id
    WHERE auth_user_id IS NULL AND email = NEW.email;
  END IF;

  IF to_regclass('public.profesores') IS NOT NULL THEN
    UPDATE public.profesores
      SET auth_user_id = NEW.id
    WHERE auth_user_id IS NULL AND email = NEW.email;
  END IF;

  UPDATE public.administrador
    SET email = COALESCE(NULLIF(email, ''), NEW.email)
  WHERE id = NEW.id;

  v_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'rol', NEW.raw_user_meta_data->>'role', ''));

  IF v_role = 'administrador' THEN
    v_tipo_identificacion := UPPER(COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'tipo_identificacion'), ''), 'CC'));

    IF v_tipo_identificacion NOT IN ('CC', 'TI', 'CE', 'RCN', 'PAS', 'PPT') THEN
      v_tipo_identificacion := 'CC';
    END IF;

    v_numero_identificacion := NULLIF(BTRIM(NEW.raw_user_meta_data->>'numero_identificacion'), '');

    IF v_numero_identificacion IS NULL THEN
      v_localpart := REGEXP_REPLACE(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), '[^0-9A-Za-z]', '', 'g');

      IF v_localpart = '' THEN
        v_numero_identificacion := 'ADM-' || LEFT(REPLACE(NEW.id::text, '-', ''), 12);
      ELSE
        v_numero_identificacion := LEFT(v_localpart, 20);
      END IF;
    END IF;

    INSERT INTO public.administrador (
      id,
      tipo_identificacion,
      numero_identificacion,
      nombres,
      apellidos,
      email,
      aprobado,
      role
    )
    VALUES (
      NEW.id,
      v_tipo_identificacion,
      v_numero_identificacion,
      COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'nombres'), ''), COALESCE(NEW.raw_user_meta_data->>'first_name', '')),
      COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'apellidos'), ''), COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
      NEW.email,
      false,
      'administrador'
    )
    ON CONFLICT (id) DO UPDATE
      SET tipo_identificacion = COALESCE(NULLIF(public.administrador.tipo_identificacion, ''), EXCLUDED.tipo_identificacion),
          numero_identificacion = COALESCE(NULLIF(public.administrador.numero_identificacion, ''), EXCLUDED.numero_identificacion),
          nombres = COALESCE(NULLIF(public.administrador.nombres, ''), EXCLUDED.nombres),
          apellidos = COALESCE(NULLIF(public.administrador.apellidos, ''), EXCLUDED.apellidos),
          email = COALESCE(NULLIF(public.administrador.email, ''), EXCLUDED.email),
          role = 'administrador';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_profile_linked ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile_link();

DROP TRIGGER IF EXISTS trg_sync_profile_admin ON public.administrador;
CREATE TRIGGER trg_sync_profile_admin
  AFTER INSERT OR UPDATE ON public.administrador
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_admin();

INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
SELECT
  a.id,
  a.nombres,
  a.apellidos,
  COALESCE(NULLIF(a.email, ''), u.email, 'admin+' || LEFT(a.id::text, 8) || '@example.com'),
  'administrador'::public.role_enum,
  COALESCE(a.aprobado, false)
FROM public.administrador a
LEFT JOIN auth.users u ON u.id = a.id
ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      apellido = EXCLUDED.apellido,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      approved = EXCLUDED.approved;

COMMIT;
