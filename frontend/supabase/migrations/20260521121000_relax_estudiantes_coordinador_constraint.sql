BEGIN;

ALTER TABLE IF EXISTS public.estudiantes
  DROP CONSTRAINT IF EXISTS chk_estudiantes_coordinador;

ALTER TABLE IF EXISTS public.estudiantes
  ADD CONSTRAINT chk_estudiantes_coordinador
  CHECK (BTRIM(coordinador_academico) <> '');

COMMIT;
