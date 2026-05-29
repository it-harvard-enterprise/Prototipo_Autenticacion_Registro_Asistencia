BEGIN;

CREATE OR REPLACE FUNCTION public.is_approved_admin_or_professor() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('administrador', 'profesor')
      AND p.approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.grade_is_valid(value numeric) RETURNS boolean
  LANGUAGE sql IMMUTABLE
AS $$
  SELECT value IS NULL OR (value >= 0 AND value <= 5);
$$;

CREATE TABLE IF NOT EXISTS public.periodos_academicos (
  id bigserial PRIMARY KEY,
  period_label character varying(10) NOT NULL,
  period_year integer NOT NULL,
  period_term smallint NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  auto_generado boolean NOT NULL DEFAULT true,
  creado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_periodos_academicos_label UNIQUE (period_label),
  CONSTRAINT uq_periodos_academicos_year_term UNIQUE (period_year, period_term),
  CONSTRAINT chk_periodos_academicos_term CHECK (period_term IN (1, 2)),
  CONSTRAINT chk_periodos_academicos_fechas CHECK (fecha_fin > fecha_inicio)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'periodos_academicos_creado_por_fkey'
      AND conrelid = 'public.periodos_academicos'::regclass
  ) THEN
    ALTER TABLE public.periodos_academicos
      ADD CONSTRAINT periodos_academicos_creado_por_fkey
      FOREIGN KEY (creado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_periodos_academicos_year_term
  ON public.periodos_academicos (period_year DESC, period_term DESC);

CREATE INDEX IF NOT EXISTS idx_periodos_academicos_fechas
  ON public.periodos_academicos (fecha_inicio, fecha_fin);

ALTER TABLE public.profesores
  ADD COLUMN IF NOT EXISTS firma_docente_data_url text,
  ADD COLUMN IF NOT EXISTS firma_docente_actualizada_en timestamp with time zone,
  ADD COLUMN IF NOT EXISTS firma_docente_actualizada_por uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profesores_firma_docente_actualizada_por_fkey'
      AND conrelid = 'public.profesores'::regclass
  ) THEN
    ALTER TABLE public.profesores
      ADD CONSTRAINT profesores_firma_docente_actualizada_por_fkey
      FOREIGN KEY (firma_docente_actualizada_por) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_profesores_firma_docente_data_url'
      AND conrelid = 'public.profesores'::regclass
  ) THEN
    ALTER TABLE public.profesores
      ADD CONSTRAINT chk_profesores_firma_docente_data_url
      CHECK (
        firma_docente_data_url IS NULL
        OR firma_docente_data_url ~ '^data:image\\/[a-zA-Z0-9.+-]+;base64,'
      ) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.profesores
  VALIDATE CONSTRAINT chk_profesores_firma_docente_data_url;

CREATE TABLE IF NOT EXISTS public.calificaciones_estudiantes (
  id bigserial PRIMARY KEY,
  period_id bigint NOT NULL,
  id_curso integer NOT NULL,
  numero_identificacion character varying(20) NOT NULL,
  ingles_speaking_1 numeric(3,2),
  ingles_speaking_2 numeric(3,2),
  ingles_listening_1 numeric(3,2),
  ingles_listening_2 numeric(3,2),
  ingles_writing_1 numeric(3,2),
  ingles_writing_2 numeric(3,2),
  ingles_reading_1 numeric(3,2),
  ingles_reading_2 numeric(3,2),
  ingles_grammar_1 numeric(3,2),
  ingles_grammar_2 numeric(3,2),
  ingles_definitiva numeric(3,2),
  ingles_comentarios_docente text,
  matematicas_pro numeric(3,2),
  matematicas_sol numeric(3,2),
  matematicas_com numeric(3,2),
  matematicas_raz numeric(3,2),
  matematicas_definitiva numeric(3,2),
  matematicas_comentarios_docente text,
  sistemas_definitiva numeric(3,2),
  sistemas_notas_docente text,
  comentarios_generales_docente text,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_calificaciones_periodo_curso_estudiante UNIQUE (period_id, id_curso, numero_identificacion),
  CONSTRAINT chk_calificaciones_ingles_speaking_1 CHECK (public.grade_is_valid(ingles_speaking_1)),
  CONSTRAINT chk_calificaciones_ingles_speaking_2 CHECK (public.grade_is_valid(ingles_speaking_2)),
  CONSTRAINT chk_calificaciones_ingles_listening_1 CHECK (public.grade_is_valid(ingles_listening_1)),
  CONSTRAINT chk_calificaciones_ingles_listening_2 CHECK (public.grade_is_valid(ingles_listening_2)),
  CONSTRAINT chk_calificaciones_ingles_writing_1 CHECK (public.grade_is_valid(ingles_writing_1)),
  CONSTRAINT chk_calificaciones_ingles_writing_2 CHECK (public.grade_is_valid(ingles_writing_2)),
  CONSTRAINT chk_calificaciones_ingles_reading_1 CHECK (public.grade_is_valid(ingles_reading_1)),
  CONSTRAINT chk_calificaciones_ingles_reading_2 CHECK (public.grade_is_valid(ingles_reading_2)),
  CONSTRAINT chk_calificaciones_ingles_grammar_1 CHECK (public.grade_is_valid(ingles_grammar_1)),
  CONSTRAINT chk_calificaciones_ingles_grammar_2 CHECK (public.grade_is_valid(ingles_grammar_2)),
  CONSTRAINT chk_calificaciones_ingles_definitiva CHECK (public.grade_is_valid(ingles_definitiva)),
  CONSTRAINT chk_calificaciones_matematicas_pro CHECK (public.grade_is_valid(matematicas_pro)),
  CONSTRAINT chk_calificaciones_matematicas_sol CHECK (public.grade_is_valid(matematicas_sol)),
  CONSTRAINT chk_calificaciones_matematicas_com CHECK (public.grade_is_valid(matematicas_com)),
  CONSTRAINT chk_calificaciones_matematicas_raz CHECK (public.grade_is_valid(matematicas_raz)),
  CONSTRAINT chk_calificaciones_matematicas_definitiva CHECK (public.grade_is_valid(matematicas_definitiva)),
  CONSTRAINT chk_calificaciones_sistemas_definitiva CHECK (public.grade_is_valid(sistemas_definitiva))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calificaciones_estudiantes_period_id_fkey'
      AND conrelid = 'public.calificaciones_estudiantes'::regclass
  ) THEN
    ALTER TABLE public.calificaciones_estudiantes
      ADD CONSTRAINT calificaciones_estudiantes_period_id_fkey
      FOREIGN KEY (period_id) REFERENCES public.periodos_academicos(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calificaciones_estudiantes_id_curso_fkey'
      AND conrelid = 'public.calificaciones_estudiantes'::regclass
  ) THEN
    ALTER TABLE public.calificaciones_estudiantes
      ADD CONSTRAINT calificaciones_estudiantes_id_curso_fkey
      FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calificaciones_estudiantes_numero_identificacion_fkey'
      AND conrelid = 'public.calificaciones_estudiantes'::regclass
  ) THEN
    ALTER TABLE public.calificaciones_estudiantes
      ADD CONSTRAINT calificaciones_estudiantes_numero_identificacion_fkey
      FOREIGN KEY (numero_identificacion) REFERENCES public.estudiantes(numero_identificacion)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calificaciones_estudiantes_updated_by_fkey'
      AND conrelid = 'public.calificaciones_estudiantes'::regclass
  ) THEN
    ALTER TABLE public.calificaciones_estudiantes
      ADD CONSTRAINT calificaciones_estudiantes_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_calificaciones_periodo_curso
  ON public.calificaciones_estudiantes (period_id, id_curso);

CREATE INDEX IF NOT EXISTS idx_calificaciones_curso
  ON public.calificaciones_estudiantes (id_curso);

CREATE INDEX IF NOT EXISTS idx_calificaciones_estudiante
  ON public.calificaciones_estudiantes (numero_identificacion);

CREATE OR REPLACE FUNCTION public.set_updated_at_periodos_academicos() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_calificaciones_estudiantes() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_periodos_academicos ON public.periodos_academicos;
CREATE TRIGGER trg_set_updated_at_periodos_academicos
  BEFORE UPDATE ON public.periodos_academicos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_periodos_academicos();

DROP TRIGGER IF EXISTS trg_set_updated_at_calificaciones_estudiantes ON public.calificaciones_estudiantes;
CREATE TRIGGER trg_set_updated_at_calificaciones_estudiantes
  BEFORE UPDATE ON public.calificaciones_estudiantes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_calificaciones_estudiantes();

ALTER TABLE public.periodos_academicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones_estudiantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_periodos_academicos_select_authenticated ON public.periodos_academicos;
CREATE POLICY p_periodos_academicos_select_authenticated
  ON public.periodos_academicos
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.approved = true
    )
  );

DROP POLICY IF EXISTS p_periodos_academicos_manage ON public.periodos_academicos;
CREATE POLICY p_periodos_academicos_manage
  ON public.periodos_academicos
  USING (public.is_approved_admin_or_professor())
  WITH CHECK (public.is_approved_admin_or_professor());

DROP POLICY IF EXISTS p_calificaciones_estudiantes_select_authorized ON public.calificaciones_estudiantes;
CREATE POLICY p_calificaciones_estudiantes_select_authorized
  ON public.calificaciones_estudiantes
  FOR SELECT
  USING (
    public.is_approved_admin_or_professor()
    OR EXISTS (
      SELECT 1
      FROM public.estudiantes e
      WHERE e.numero_identificacion = calificaciones_estudiantes.numero_identificacion
        AND e.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS p_calificaciones_estudiantes_manage ON public.calificaciones_estudiantes;
CREATE POLICY p_calificaciones_estudiantes_manage
  ON public.calificaciones_estudiantes
  USING (public.is_approved_admin_or_professor())
  WITH CHECK (public.is_approved_admin_or_professor());

COMMIT;
