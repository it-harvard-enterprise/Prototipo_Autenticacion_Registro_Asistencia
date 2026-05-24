BEGIN;

ALTER TABLE IF EXISTS public.estudiantes
  ALTER COLUMN huella_indice_derecho DROP NOT NULL,
  ALTER COLUMN huella_indice_izquierdo DROP NOT NULL;

ALTER TABLE IF EXISTS public.estudiantes
  DROP CONSTRAINT IF EXISTS estudiantes_huella_indice_derecho_check,
  DROP CONSTRAINT IF EXISTS estudiantes_huella_indice_izquierdo_check;

ALTER TABLE IF EXISTS public.estudiantes
  ADD CONSTRAINT estudiantes_huella_indice_derecho_check
  CHECK (
    huella_indice_derecho IS NULL OR btrim(huella_indice_derecho) <> ''
  ),
  ADD CONSTRAINT estudiantes_huella_indice_izquierdo_check
  CHECK (
    huella_indice_izquierdo IS NULL OR btrim(huella_indice_izquierdo) <> ''
  );

COMMIT;
