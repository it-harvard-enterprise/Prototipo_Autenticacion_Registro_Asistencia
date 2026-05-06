-- ============================================================
-- MIGRACION: perfiles, roles y profesores
-- Ejecutar en la base de datos existente (sin borrar datos).
-- ============================================================

BEGIN;

-- 1) Enum de roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
    CREATE TYPE public.role_enum AS ENUM ('administrador', 'estudiante', 'profesor');
  END IF;
END $$;

-- 2) Tabla de perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(200) NOT NULL,
  role public.role_enum NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at_profiles()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_profiles ON public.profiles;
CREATE TRIGGER trg_set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_profiles();

-- 3) Ajustes a administrador
ALTER TABLE public.administrador
  ADD COLUMN IF NOT EXISTS tipo_identificacion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS numero_identificacion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS email VARCHAR(200);

UPDATE public.administrador a
SET
  tipo_identificacion = COALESCE(a.tipo_identificacion, 'CC'),
  numero_identificacion = COALESCE(a.numero_identificacion, '12345'),
  email = COALESCE(a.email, u.email, 'admin+' || LEFT(a.id::text, 8) || '@example.com')
FROM auth.users u
WHERE u.id = a.id;

-- 4) Ajustes a estudiantes
ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_estudiantes_email ON public.estudiantes(email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_estudiantes_auth_user_id
  ON public.estudiantes(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 5) Tabla profesores
CREATE TABLE IF NOT EXISTS public.profesores (
  numero_identificacion VARCHAR(20) PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_identificacion VARCHAR(20) NOT NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  direccion VARCHAR(200) NOT NULL,
  barrio VARCHAR(100) NOT NULL,
  nombre_contacto_emergencia VARCHAR(200) NOT NULL,
  telefono_contacto_emergencia VARCHAR(20) NOT NULL,
  eps VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_profesores_tipo_identificacion
    CHECK (tipo_identificacion IN ('CC', 'TI', 'CE', 'RCN', 'PAS', 'PPT')),
  CONSTRAINT chk_profesores_eps
    CHECK (BTRIM(eps) <> '')
);

CREATE OR REPLACE FUNCTION public.set_updated_at_profesores()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_profesores ON public.profesores;
CREATE TRIGGER trg_set_updated_at_profesores
  BEFORE UPDATE ON public.profesores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_profesores();

CREATE INDEX IF NOT EXISTS idx_profesores_email ON public.profesores(email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_profesores_auth_user_id
  ON public.profesores(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 6) Sincronizacion perfiles <-> tablas
CREATE OR REPLACE FUNCTION public.sync_profile_from_admin()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_profile_from_estudiante()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_profile_from_profesor()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_admin ON public.administrador;
CREATE TRIGGER trg_sync_profile_admin
  AFTER INSERT OR UPDATE ON public.administrador
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_admin();

DROP TRIGGER IF EXISTS trg_sync_profile_estudiante ON public.estudiantes;
CREATE TRIGGER trg_sync_profile_estudiante
  AFTER INSERT OR UPDATE ON public.estudiantes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_estudiante();

DROP TRIGGER IF EXISTS trg_sync_profile_profesor ON public.profesores;
CREATE TRIGGER trg_sync_profile_profesor
  AFTER INSERT OR UPDATE ON public.profesores
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_profesor();

-- 7) Link auth.users -> estudiantes/profesores
CREATE OR REPLACE FUNCTION public.handle_new_user_profile_link()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile_link();

-- 8) Perfiles para administradores existentes
INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
SELECT
  a.id,
  a.nombres,
  a.apellidos,
  COALESCE(a.email, u.email, 'admin+' || LEFT(a.id::text, 8) || '@example.com'),
  'administrador'::public.role_enum,
  a.aprobado
FROM public.administrador a
LEFT JOIN auth.users u ON u.id = a.id
ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      apellido = EXCLUDED.apellido,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      approved = EXCLUDED.approved;

-- 9) RBAC: admin aprobado via profiles
CREATE OR REPLACE FUNCTION public.is_approved_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'administrador'
      AND p.approved = TRUE
  );
$$;

-- 10) RLS para nuevas tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_profiles_select_self ON public.profiles;
CREATE POLICY p_profiles_select_self
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid() OR public.is_approved_admin());

DROP POLICY IF EXISTS p_profiles_admin_all ON public.profiles;
CREATE POLICY p_profiles_admin_all
  ON public.profiles
  FOR ALL
  USING (public.is_approved_admin())
  WITH CHECK (public.is_approved_admin());

DROP POLICY IF EXISTS p_profesores_all_approved_admin ON public.profesores;
CREATE POLICY p_profesores_all_approved_admin
  ON public.profesores
  FOR ALL
  USING (public.is_approved_admin())
  WITH CHECK (public.is_approved_admin());

DROP POLICY IF EXISTS p_profesores_select_self ON public.profesores;
CREATE POLICY p_profesores_select_self
  ON public.profesores
  FOR SELECT
  USING (auth_user_id = auth.uid());

COMMIT;
