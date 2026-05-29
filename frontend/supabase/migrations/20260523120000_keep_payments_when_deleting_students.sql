BEGIN;

DO $$
DECLARE
  fk_record record;
BEGIN
  FOR fk_record IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND rel.relname = 'pagos'
      AND con.confrelid = 'public.estudiantes'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS %I', fk_record.conname);
  END LOOP;
END;
$$;

ALTER TABLE IF EXISTS public.pagos
  ALTER COLUMN numero_identificacion DROP NOT NULL;

ALTER TABLE IF EXISTS public.pagos
  ADD CONSTRAINT pagos_numero_identificacion_fkey
  FOREIGN KEY (numero_identificacion)
  REFERENCES public.estudiantes (numero_identificacion)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

COMMIT;
