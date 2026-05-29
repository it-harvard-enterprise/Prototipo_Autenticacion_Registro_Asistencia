BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'tipo_pago_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.tipo_pago_enum AS ENUM (
      'clase_presencial',
      'adelanto',
      'abono_matricula',
      'otro'
    );
  END IF;
END;
$$;

ALTER TYPE public.tipo_pago_enum ADD VALUE IF NOT EXISTS 'clase_presencial';
ALTER TYPE public.tipo_pago_enum ADD VALUE IF NOT EXISTS 'adelanto';
ALTER TYPE public.tipo_pago_enum ADD VALUE IF NOT EXISTS 'abono_matricula';
ALTER TYPE public.tipo_pago_enum ADD VALUE IF NOT EXISTS 'otro';

CREATE TABLE IF NOT EXISTS public.saldo_estudiantes (
  numero_identificacion varchar(20) PRIMARY KEY
    REFERENCES public.estudiantes(numero_identificacion)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  clases_adelantadas integer NOT NULL DEFAULT 0,
  clases_adeudadas integer NOT NULL DEFAULT 0,
  total_pagado numeric(12,2) NOT NULL DEFAULT 0,
  ultima_actualizacion timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_saldo_clases_adelantadas'
      AND conrelid = 'public.saldo_estudiantes'::regclass
  ) THEN
    ALTER TABLE public.saldo_estudiantes
      ADD CONSTRAINT chk_saldo_clases_adelantadas
      CHECK (clases_adelantadas >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_saldo_clases_adeudadas'
      AND conrelid = 'public.saldo_estudiantes'::regclass
  ) THEN
    ALTER TABLE public.saldo_estudiantes
      ADD CONSTRAINT chk_saldo_clases_adeudadas
      CHECK (clases_adeudadas >= 0);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_identificacion varchar(20) NOT NULL
    REFERENCES public.estudiantes(numero_identificacion)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  id_curso integer
    REFERENCES public.cursos(id_curso)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  id_asistencia integer
    REFERENCES public.registro_asistencia(id)
    ON DELETE SET NULL,
  registrado_por uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE RESTRICT,
  tipo_pago public.tipo_pago_enum NOT NULL,
  metodo_pago public.metodo_pago_enum NOT NULL,
  valor numeric(12,2) NOT NULL,
  clases_adelantadas integer NOT NULL DEFAULT 0,
  notas text,
  fecha_pago timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_pagos_valor'
      AND conrelid = 'public.pagos'::regclass
  ) THEN
    ALTER TABLE public.pagos
      ADD CONSTRAINT chk_pagos_valor
      CHECK (valor > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_pagos_clases_adelantadas'
      AND conrelid = 'public.pagos'::regclass
  ) THEN
    ALTER TABLE public.pagos
      ADD CONSTRAINT chk_pagos_clases_adelantadas
      CHECK (clases_adelantadas >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_pagos_adelanto_requiere_clases'
      AND conrelid = 'public.pagos'::regclass
  ) THEN
    ALTER TABLE public.pagos
      ADD CONSTRAINT chk_pagos_adelanto_requiere_clases
      CHECK (
        tipo_pago <> 'adelanto' OR clases_adelantadas > 0
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_pagos_estudiante
  ON public.pagos (numero_identificacion);

CREATE INDEX IF NOT EXISTS idx_pagos_fecha
  ON public.pagos (fecha_pago);

CREATE INDEX IF NOT EXISTS idx_pagos_curso
  ON public.pagos (id_curso);

CREATE INDEX IF NOT EXISTS idx_pagos_asistencia
  ON public.pagos (id_asistencia);

ALTER TABLE public.registro_asistencia
  ADD COLUMN IF NOT EXISTS id_pago uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'registro_asistencia_id_pago_fkey'
      AND conrelid = 'public.registro_asistencia'::regclass
  ) THEN
    ALTER TABLE public.registro_asistencia
      ADD CONSTRAINT registro_asistencia_id_pago_fkey
      FOREIGN KEY (id_pago)
      REFERENCES public.pagos(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_registro_asistencia_pago
  ON public.registro_asistencia (id_pago);

ALTER TABLE public.registro_asistencia
  DROP CONSTRAINT IF EXISTS chk_metodo_pago;

ALTER TABLE public.registro_asistencia
  ADD CONSTRAINT chk_metodo_pago
  CHECK (
    ((saldo = 'debe'::public.saldo_enum) AND metodo_pago IS NULL)
    OR (saldo = 'cancelado'::public.saldo_enum)
    OR (saldo IS NULL)
  ) NOT VALID;

ALTER TABLE public.registro_asistencia
  VALIDATE CONSTRAINT chk_metodo_pago;

INSERT INTO public.saldo_estudiantes (numero_identificacion)
SELECT e.numero_identificacion
FROM public.estudiantes e
ON CONFLICT (numero_identificacion) DO NOTHING;

UPDATE public.saldo_estudiantes s
SET
  clases_adeudadas = d.clases_adeudadas,
  ultima_actualizacion = NOW()
FROM (
  SELECT
    ra.numero_identificacion,
    COUNT(*)::integer AS clases_adeudadas
  FROM public.registro_asistencia ra
  WHERE ra.asistio = TRUE
    AND ra.saldo = 'debe'::public.saldo_enum
  GROUP BY ra.numero_identificacion
) d
WHERE d.numero_identificacion = s.numero_identificacion
  AND COALESCE(s.clases_adeudadas, 0) = 0;

CREATE OR REPLACE FUNCTION public.handle_new_estudiante()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.saldo_estudiantes (numero_identificacion)
  VALUES (NEW.numero_identificacion)
  ON CONFLICT (numero_identificacion) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_estudiante_saldo ON public.estudiantes;
CREATE TRIGGER trg_new_estudiante_saldo
  AFTER INSERT ON public.estudiantes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_estudiante();

CREATE OR REPLACE FUNCTION public.handle_new_pago()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.saldo_estudiantes (
    numero_identificacion,
    clases_adelantadas,
    total_pagado
  )
  VALUES (
    NEW.numero_identificacion,
    CASE WHEN NEW.tipo_pago = 'adelanto' THEN NEW.clases_adelantadas ELSE 0 END,
    NEW.valor
  )
  ON CONFLICT (numero_identificacion) DO UPDATE
  SET
    clases_adelantadas =
      public.saldo_estudiantes.clases_adelantadas
      + CASE WHEN NEW.tipo_pago = 'adelanto' THEN NEW.clases_adelantadas ELSE 0 END,
    total_pagado = public.saldo_estudiantes.total_pagado + NEW.valor,
    ultima_actualizacion = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_pago ON public.pagos;
CREATE TRIGGER trg_new_pago
  AFTER INSERT ON public.pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_pago();

CREATE OR REPLACE FUNCTION public.handle_asistencia_pago()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.saldo_estudiantes (numero_identificacion)
  VALUES (NEW.numero_identificacion)
  ON CONFLICT (numero_identificacion) DO NOTHING;

  IF TG_OP = 'INSERT' THEN
    IF NEW.asistio = TRUE THEN
      IF EXISTS (
        SELECT 1
        FROM public.saldo_estudiantes
        WHERE numero_identificacion = NEW.numero_identificacion
          AND clases_adelantadas > 0
      ) THEN
        UPDATE public.saldo_estudiantes
        SET
          clases_adelantadas = clases_adelantadas - 1,
          ultima_actualizacion = NOW()
        WHERE numero_identificacion = NEW.numero_identificacion;
      ELSIF NEW.saldo = 'debe'::public.saldo_enum THEN
        UPDATE public.saldo_estudiantes
        SET
          clases_adeudadas = clases_adeudadas + 1,
          ultima_actualizacion = NOW()
        WHERE numero_identificacion = NEW.numero_identificacion;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF COALESCE(OLD.asistio, FALSE) = FALSE
     AND NEW.asistio = TRUE THEN
    IF EXISTS (
      SELECT 1
      FROM public.saldo_estudiantes
      WHERE numero_identificacion = NEW.numero_identificacion
        AND clases_adelantadas > 0
    ) THEN
      UPDATE public.saldo_estudiantes
      SET
        clases_adelantadas = clases_adelantadas - 1,
        ultima_actualizacion = NOW()
      WHERE numero_identificacion = NEW.numero_identificacion;
    ELSIF NEW.saldo = 'debe'::public.saldo_enum THEN
      UPDATE public.saldo_estudiantes
      SET
        clases_adeudadas = clases_adeudadas + 1,
        ultima_actualizacion = NOW()
      WHERE numero_identificacion = NEW.numero_identificacion;
    END IF;

    RETURN NEW;
  END IF;

  IF COALESCE(OLD.asistio, FALSE) = TRUE
     AND NEW.asistio = FALSE THEN
    IF OLD.saldo = 'debe'::public.saldo_enum THEN
      UPDATE public.saldo_estudiantes
      SET
        clases_adeudadas = GREATEST(clases_adeudadas - 1, 0),
        ultima_actualizacion = NOW()
      WHERE numero_identificacion = NEW.numero_identificacion;
    END IF;

    RETURN NEW;
  END IF;

  IF COALESCE(OLD.asistio, FALSE) = TRUE
     AND NEW.asistio = TRUE
     AND COALESCE(OLD.saldo::text, '') IS DISTINCT FROM COALESCE(NEW.saldo::text, '') THEN
    IF OLD.saldo = 'debe'::public.saldo_enum THEN
      UPDATE public.saldo_estudiantes
      SET
        clases_adeudadas = GREATEST(clases_adeudadas - 1, 0),
        ultima_actualizacion = NOW()
      WHERE numero_identificacion = NEW.numero_identificacion;
    END IF;

    IF NEW.saldo = 'debe'::public.saldo_enum THEN
      UPDATE public.saldo_estudiantes
      SET
        clases_adeudadas = clases_adeudadas + 1,
        ultima_actualizacion = NOW()
      WHERE numero_identificacion = NEW.numero_identificacion;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asistencia_saldo ON public.registro_asistencia;
CREATE TRIGGER trg_asistencia_saldo
  AFTER INSERT OR UPDATE ON public.registro_asistencia
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_asistencia_pago();

DROP VIEW IF EXISTS public.vista_reporte_pagos;

CREATE VIEW public.vista_reporte_pagos
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.fecha_pago,
  e.nombres || ' ' || e.apellidos AS estudiante,
  e.numero_identificacion,
  c.nombre_curso,
  p.tipo_pago,
  p.metodo_pago,
  p.valor,
  p.clases_adelantadas,
  COALESCE(adm.nombre, '') || CASE WHEN adm.apellido IS NOT NULL THEN ' ' || adm.apellido ELSE '' END AS registrado_por,
  p.notas
FROM public.pagos p
JOIN public.estudiantes e
  ON e.numero_identificacion = p.numero_identificacion
LEFT JOIN public.cursos c
  ON c.id_curso = p.id_curso
LEFT JOIN public.profiles adm
  ON adm.id = p.registrado_por
ORDER BY p.fecha_pago DESC;

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldo_estudiantes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pagos'
      AND policyname = 'p_pagos_all_approved_admin'
  ) THEN
    CREATE POLICY p_pagos_all_approved_admin
      ON public.pagos
      USING (public.is_approved_admin())
      WITH CHECK (public.is_approved_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saldo_estudiantes'
      AND policyname = 'p_saldo_estudiantes_all_approved_admin'
  ) THEN
    CREATE POLICY p_saldo_estudiantes_all_approved_admin
      ON public.saldo_estudiantes
      USING (public.is_approved_admin())
      WITH CHECK (public.is_approved_admin());
  END IF;
END;
$$;

COMMIT;
