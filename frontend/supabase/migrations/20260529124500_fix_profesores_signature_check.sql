BEGIN;

ALTER TABLE public.profesores
  DROP CONSTRAINT IF EXISTS chk_profesores_firma_docente_data_url;

UPDATE public.profesores
SET firma_docente_data_url = btrim(firma_docente_data_url)
WHERE firma_docente_data_url IS NOT NULL;

ALTER TABLE public.profesores
  ADD CONSTRAINT chk_profesores_firma_docente_data_url
  CHECK (
    firma_docente_data_url IS NULL
    OR btrim(firma_docente_data_url) ~* '^data:image\/(png|jpe?g);base64,[A-Za-z0-9+\/_=-]+$'
  ) NOT VALID;

ALTER TABLE public.profesores
  VALIDATE CONSTRAINT chk_profesores_firma_docente_data_url;

COMMIT;
