-- ============================================================
-- MIGRATION: Rename metodo_pago_enum labels to uppercase
-- Safe/idempotent: each rename runs only if lowercase label exists.
-- ============================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public'
          AND t.typname = 'metodo_pago_enum'
          AND e.enumlabel = 'efectivo'
    ) THEN
        ALTER TYPE public.metodo_pago_enum RENAME VALUE 'efectivo' TO 'EFECTIVO';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public'
          AND t.typname = 'metodo_pago_enum'
          AND e.enumlabel = 'transferencia'
    ) THEN
        ALTER TYPE public.metodo_pago_enum RENAME VALUE 'transferencia' TO 'TRANSFERENCIA';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public'
          AND t.typname = 'metodo_pago_enum'
          AND e.enumlabel = 'nequi'
    ) THEN
        ALTER TYPE public.metodo_pago_enum RENAME VALUE 'nequi' TO 'NEQUI';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public'
          AND t.typname = 'metodo_pago_enum'
          AND e.enumlabel = 'daviplata'
    ) THEN
        ALTER TYPE public.metodo_pago_enum RENAME VALUE 'daviplata' TO 'DAVIPLATA';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public'
          AND t.typname = 'metodo_pago_enum'
          AND e.enumlabel = 'otro'
    ) THEN
        ALTER TYPE public.metodo_pago_enum RENAME VALUE 'otro' TO 'OTRO';
    END IF;
END
$$;

COMMIT;
