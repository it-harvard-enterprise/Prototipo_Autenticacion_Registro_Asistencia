BEGIN;

-- Delete from profiles -> delete corresponding auth user.
CREATE OR REPLACE FUNCTION public.handle_profile_deleted_delete_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.id IS NULL THEN
    RETURN OLD;
  END IF;

  DELETE FROM auth.users u
  WHERE u.id = OLD.id;

  RETURN OLD;
END;
$$;

-- Delete from administrador -> delete corresponding auth user.
CREATE OR REPLACE FUNCTION public.handle_admin_deleted_delete_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.id IS NULL THEN
    RETURN OLD;
  END IF;

  DELETE FROM auth.users u
  WHERE u.id = OLD.id;

  RETURN OLD;
END;
$$;

-- Delete from auth.users ->
-- 1) delete profile row,
-- 2) delete administrador row,
-- 3) null auth_user_id in estudiantes/profesores.
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted_cleanup_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Keep explicit cleanup even if FK cascades already do this,
  -- to enforce behavior across environments.
  DELETE FROM public.profiles p
  WHERE p.id = OLD.id;

  DELETE FROM public.administrador a
  WHERE a.id = OLD.id;

  IF to_regclass('public.estudiantes') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'estudiantes'
        AND column_name = 'auth_user_id'
    ) THEN
      UPDATE public.estudiantes
      SET auth_user_id = NULL
      WHERE auth_user_id = OLD.id;
    END IF;
  END IF;

  IF to_regclass('public.profesores') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profesores'
        AND column_name = 'auth_user_id'
    ) THEN
      UPDATE public.profesores
      SET auth_user_id = NULL
      WHERE auth_user_id = OLD.id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_deleted_delete_auth ON public.profiles;
CREATE TRIGGER trg_profile_deleted_delete_auth
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_deleted_delete_auth();

DROP TRIGGER IF EXISTS trg_admin_deleted_delete_auth ON public.administrador;
CREATE TRIGGER trg_admin_deleted_delete_auth
AFTER DELETE ON public.administrador
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_deleted_delete_auth();

DROP TRIGGER IF EXISTS trg_auth_user_deleted_cleanup_public ON auth.users;
CREATE TRIGGER trg_auth_user_deleted_cleanup_public
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_deleted_cleanup_public();

COMMIT;
