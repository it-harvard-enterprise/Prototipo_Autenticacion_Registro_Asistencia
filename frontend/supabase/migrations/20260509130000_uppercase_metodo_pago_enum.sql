BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'metodo_pago_enum'
      AND n.nspname = 'public'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'efectivo'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'EFECTIVO'
    ) THEN
      ALTER TYPE public.metodo_pago_enum RENAME VALUE 'efectivo' TO 'EFECTIVO';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'transferencia'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'TRANSFERENCIA'
    ) THEN
      ALTER TYPE public.metodo_pago_enum RENAME VALUE 'transferencia' TO 'TRANSFERENCIA';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'nequi'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'NEQUI'
    ) THEN
      ALTER TYPE public.metodo_pago_enum RENAME VALUE 'nequi' TO 'NEQUI';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'daviplata'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'DAVIPLATA'
    ) THEN
      ALTER TYPE public.metodo_pago_enum RENAME VALUE 'daviplata' TO 'DAVIPLATA';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'otro'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.metodo_pago_enum'::regtype
        AND e.enumlabel = 'OTRO'
    ) THEN
      ALTER TYPE public.metodo_pago_enum RENAME VALUE 'otro' TO 'OTRO';
    END IF;
  END IF;
END;
$$;

COMMIT;
