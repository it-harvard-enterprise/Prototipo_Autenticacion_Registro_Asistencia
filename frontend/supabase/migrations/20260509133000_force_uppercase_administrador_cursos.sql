BEGIN;

CREATE OR REPLACE FUNCTION public.force_uppercase_administrador()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nombres := UPPER(BTRIM(NEW.nombres));
  NEW.apellidos := UPPER(BTRIM(NEW.apellidos));

  IF NEW.tipo_identificacion IS NOT NULL THEN
    NEW.tipo_identificacion := UPPER(BTRIM(NEW.tipo_identificacion));
  END IF;

  IF NEW.numero_identificacion IS NOT NULL THEN
    NEW.numero_identificacion := UPPER(BTRIM(NEW.numero_identificacion));
  END IF;

  IF NEW.email IS NOT NULL THEN
    NEW.email := UPPER(BTRIM(NEW.email));
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.force_uppercase_cursos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nombre_curso := UPPER(BTRIM(NEW.nombre_curso));
  NEW.nivel_curso := UPPER(BTRIM(NEW.nivel_curso));

  IF NEW.salon IS NOT NULL THEN
    NEW.salon := UPPER(BTRIM(NEW.salon));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_uppercase_administrador ON public.administrador;
CREATE TRIGGER trg_force_uppercase_administrador
  BEFORE INSERT OR UPDATE ON public.administrador
  FOR EACH ROW EXECUTE FUNCTION public.force_uppercase_administrador();

DROP TRIGGER IF EXISTS trg_force_uppercase_cursos ON public.cursos;
CREATE TRIGGER trg_force_uppercase_cursos
  BEFORE INSERT OR UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION public.force_uppercase_cursos();

UPDATE public.administrador
SET
  nombres = UPPER(BTRIM(nombres)),
  apellidos = UPPER(BTRIM(apellidos)),
  tipo_identificacion = CASE
    WHEN tipo_identificacion IS NULL THEN NULL
    ELSE UPPER(BTRIM(tipo_identificacion))
  END,
  numero_identificacion = CASE
    WHEN numero_identificacion IS NULL THEN NULL
    ELSE UPPER(BTRIM(numero_identificacion))
  END,
  email = CASE
    WHEN email IS NULL THEN NULL
    ELSE UPPER(BTRIM(email))
  END;

UPDATE public.cursos
SET
  nombre_curso = UPPER(BTRIM(nombre_curso)),
  nivel_curso = UPPER(BTRIM(nivel_curso)),
  salon = CASE
    WHEN salon IS NULL THEN NULL
    ELSE UPPER(BTRIM(salon))
  END;

COMMIT;
