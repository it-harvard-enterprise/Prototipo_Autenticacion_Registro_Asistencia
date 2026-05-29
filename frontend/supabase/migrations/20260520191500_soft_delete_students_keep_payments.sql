BEGIN;

ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_estudiantes_deleted_at
  ON public.estudiantes (deleted_at);

COMMIT;
