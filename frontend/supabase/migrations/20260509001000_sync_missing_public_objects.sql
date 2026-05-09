BEGIN;

-- Add missing columns introduced locally.
ALTER TABLE IF EXISTS public.administrador
  ADD COLUMN IF NOT EXISTS tipo_identificacion character varying(20),
  ADD COLUMN IF NOT EXISTS numero_identificacion character varying(20),
  ADD COLUMN IF NOT EXISTS email character varying(200);

ALTER TABLE IF EXISTS public.estudiantes
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS email character varying(200);

-- Ensure role enum exists before creating profiles.
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

-- Missing relational tables in production snapshot.
CREATE TABLE IF NOT EXISTS public.profesores (
  numero_identificacion character varying(20) NOT NULL,
  auth_user_id uuid,
  tipo_identificacion character varying(20) NOT NULL,
  nombres character varying(100) NOT NULL,
  apellidos character varying(100) NOT NULL,
  telefono character varying(20) NOT NULL,
  direccion character varying(200) NOT NULL,
  barrio character varying(100) NOT NULL,
  nombre_contacto_emergencia character varying(200) NOT NULL,
  telefono_contacto_emergencia character varying(20) NOT NULL,
  eps character varying(200) NOT NULL,
  email character varying(200) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT profesores_pkey PRIMARY KEY (numero_identificacion),
  CONSTRAINT chk_profesores_eps CHECK ((btrim((eps)::text) <> ''::text)),
  CONSTRAINT chk_profesores_tipo_identificacion CHECK (
    ((tipo_identificacion)::text = ANY (
      (ARRAY['CC'::character varying, 'TI'::character varying, 'CE'::character varying, 'RCN'::character varying, 'PAS'::character varying, 'PPT'::character varying])::text[]
    ))
  )
);

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

CREATE TABLE IF NOT EXISTS public.cursos_x_profesores (
  numero_identificacion character varying(20) NOT NULL,
  id_curso integer NOT NULL,
  fecha_inscripcion date DEFAULT CURRENT_DATE NOT NULL,
  CONSTRAINT cursos_x_profesores_pkey PRIMARY KEY (numero_identificacion, id_curso)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'estudiantes_auth_user_id_fkey'
      AND conrelid = 'public.estudiantes'::regclass
  ) THEN
    ALTER TABLE public.estudiantes
      ADD CONSTRAINT estudiantes_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profesores_auth_user_id_fkey'
      AND conrelid = 'public.profesores'::regclass
  ) THEN
    ALTER TABLE public.profesores
      ADD CONSTRAINT profesores_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cursos_x_profesores_id_curso_fkey'
      AND conrelid = 'public.cursos_x_profesores'::regclass
  ) THEN
    ALTER TABLE public.cursos_x_profesores
      ADD CONSTRAINT cursos_x_profesores_id_curso_fkey
      FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cursos_x_profesores_numero_identificacion_fkey'
      AND conrelid = 'public.cursos_x_profesores'::regclass
  ) THEN
    ALTER TABLE public.cursos_x_profesores
      ADD CONSTRAINT cursos_x_profesores_numero_identificacion_fkey
      FOREIGN KEY (numero_identificacion) REFERENCES public.profesores(numero_identificacion)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cursos_x_profesores_curso
  ON public.cursos_x_profesores USING btree (id_curso);

CREATE INDEX IF NOT EXISTS idx_estudiantes_email
  ON public.estudiantes USING btree (email);

CREATE INDEX IF NOT EXISTS idx_profesores_email
  ON public.profesores USING btree (email);

CREATE UNIQUE INDEX IF NOT EXISTS uq_estudiantes_auth_user_id
  ON public.estudiantes USING btree (auth_user_id)
  WHERE (auth_user_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_profesores_auth_user_id
  ON public.profesores USING btree (auth_user_id)
  WHERE (auth_user_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.set_updated_at_profesores() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_profiles() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile_link() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.estudiantes
    SET auth_user_id = NEW.id
  WHERE auth_user_id IS NULL AND email = NEW.email;

  UPDATE public.profesores
    SET auth_user_id = NEW.id
  WHERE auth_user_id IS NULL AND email = NEW.email;

  UPDATE public.administrador
    SET email = COALESCE(email, NEW.email)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_from_admin() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
  VALUES (NEW.id, NEW.nombres, NEW.apellidos, NEW.email, 'administrador', NEW.aprobado)
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        approved = EXCLUDED.approved;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_from_estudiante() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.auth_user_id IS NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
  VALUES (NEW.auth_user_id, NEW.nombres, NEW.apellidos, NEW.email, 'estudiante', TRUE)
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        approved = EXCLUDED.approved;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_from_profesor() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.auth_user_id IS NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
  VALUES (NEW.auth_user_id, NEW.nombres, NEW.apellidos, NEW.email, 'profesor', TRUE)
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        approved = EXCLUDED.approved;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_set_updated_at_profesores'
      AND tgrelid = 'public.profesores'::regclass
  ) THEN
    CREATE TRIGGER trg_set_updated_at_profesores
      BEFORE UPDATE ON public.profesores
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_profesores();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_set_updated_at_profiles'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_set_updated_at_profiles
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_profiles();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_profile_admin'
      AND tgrelid = 'public.administrador'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_profile_admin
      AFTER INSERT OR UPDATE ON public.administrador
      FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_admin();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_profile_estudiante'
      AND tgrelid = 'public.estudiantes'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_profile_estudiante
      AFTER INSERT OR UPDATE ON public.estudiantes
      FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_estudiante();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_profile_profesor'
      AND tgrelid = 'public.profesores'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_profile_profesor
      AFTER INSERT OR UPDATE ON public.profesores
      FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_profesor();
  END IF;
END $$;

ALTER TABLE IF EXISTS public.profesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cursos_x_profesores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cursos_x_profesores'
      AND policyname = 'p_cursos_x_profesores_all_approved_admin'
  ) THEN
    CREATE POLICY p_cursos_x_profesores_all_approved_admin
      ON public.cursos_x_profesores
      USING (public.is_approved_admin())
      WITH CHECK (public.is_approved_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profesores'
      AND policyname = 'p_profesores_all_approved_admin'
  ) THEN
    CREATE POLICY p_profesores_all_approved_admin
      ON public.profesores
      USING (public.is_approved_admin())
      WITH CHECK (public.is_approved_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profesores'
      AND policyname = 'p_profesores_select_self'
  ) THEN
    CREATE POLICY p_profesores_select_self
      ON public.profesores FOR SELECT
      USING ((auth_user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'p_profiles_admin_all'
  ) THEN
    CREATE POLICY p_profiles_admin_all
      ON public.profiles
      USING (public.is_approved_admin())
      WITH CHECK (public.is_approved_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'p_profiles_select_self'
  ) THEN
    CREATE POLICY p_profiles_select_self
      ON public.profiles FOR SELECT
      USING (((id = auth.uid()) OR public.is_approved_admin()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_profile_linked'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_profile_linked
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile_link();
  END IF;
END $$;

COMMIT;
