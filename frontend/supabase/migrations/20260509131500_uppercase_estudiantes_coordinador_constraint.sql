BEGIN;

ALTER TABLE IF EXISTS public.estudiantes
  DROP CONSTRAINT IF EXISTS chk_estudiantes_coordinador;

UPDATE public.estudiantes
SET coordinador_academico = UPPER(
  BTRIM(
    TRANSLATE(
      coordinador_academico,
      'ÁÉÍÓÚáéíóú',
      'AEIOUAEIOU'
    )
  )
)
WHERE coordinador_academico IS NOT NULL;

ALTER TABLE IF EXISTS public.estudiantes
  ADD CONSTRAINT chk_estudiantes_coordinador
  CHECK (
    (coordinador_academico)::text = ANY (
      (
        ARRAY[
          'NICOL DELGADO'::character varying,
          'SANTIAGO DELGADO'::character varying,
          'DAVID DELGADO'::character varying,
          'ELENA MARTINEZ'::character varying
        ]
      )::text[]
    )
  ) NOT VALID;

COMMIT;
