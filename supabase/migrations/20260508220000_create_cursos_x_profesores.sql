-- ============================================================
-- MIGRATION: Create cursos_x_profesores pivot table
-- Safe/idempotent: table and index are created only if missing.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cursos_x_profesores (
    numero_identificacion   VARCHAR(20) NOT NULL
        REFERENCES public.profesores(numero_identificacion) ON DELETE CASCADE,
    id_curso                INTEGER     NOT NULL
        REFERENCES public.cursos(id_curso) ON DELETE CASCADE,
    fecha_inscripcion       DATE        NOT NULL DEFAULT CURRENT_DATE,

    PRIMARY KEY (numero_identificacion, id_curso)
);

CREATE INDEX IF NOT EXISTS idx_cursos_x_profesores_curso
    ON public.cursos_x_profesores(id_curso);

COMMIT;
