-- ============================================================
-- MIGRATION: Normalize existing text fields to uppercase
-- Scope: estudiantes, profesores, administrador, profiles
-- Notes:
--   - Email fields are intentionally NOT uppercased to preserve auth matching.
--   - Enum-like values such as medio_pago_matricula are intentionally unchanged.
-- ============================================================

BEGIN;

-- Existing production schema may still enforce title-case coordinators.
-- Drop and recreate the constraint to align with uppercase normalization.
ALTER TABLE public.estudiantes
    DROP CONSTRAINT IF EXISTS chk_estudiantes_coordinador;

UPDATE public.estudiantes
SET
    tipo_identificacion = NULLIF(UPPER(BTRIM(tipo_identificacion)), ''),
    numero_identificacion = UPPER(BTRIM(numero_identificacion)),
    no_matricula = NULLIF(UPPER(BTRIM(no_matricula)), ''),
    nombres = UPPER(BTRIM(nombres)),
    apellidos = UPPER(BTRIM(apellidos)),
    grado = UPPER((grado)::text)::public.grado_enum,
    telefono = NULLIF(UPPER(BTRIM(telefono)), ''),
    direccion = NULLIF(UPPER(BTRIM(direccion)), ''),
    barrio = NULLIF(UPPER(BTRIM(barrio)), ''),
    nombre_acudiente = NULLIF(UPPER(BTRIM(nombre_acudiente)), ''),
    telefono_acudiente = NULLIF(UPPER(BTRIM(telefono_acudiente)), ''),
    eps = NULLIF(UPPER(BTRIM(eps)), ''),
    coordinador_academico = UPPER(BTRIM(coordinador_academico)),
    programa = NULLIF(UPPER(BTRIM(programa)), '');

UPDATE public.profesores
SET
    tipo_identificacion = NULLIF(UPPER(BTRIM(tipo_identificacion)), ''),
    numero_identificacion = UPPER(BTRIM(numero_identificacion)),
    nombres = UPPER(BTRIM(nombres)),
    apellidos = UPPER(BTRIM(apellidos)),
    telefono = NULLIF(UPPER(BTRIM(telefono)), ''),
    direccion = NULLIF(UPPER(BTRIM(direccion)), ''),
    barrio = NULLIF(UPPER(BTRIM(barrio)), ''),
    nombre_contacto_emergencia = NULLIF(UPPER(BTRIM(nombre_contacto_emergencia)), ''),
    telefono_contacto_emergencia = NULLIF(UPPER(BTRIM(telefono_contacto_emergencia)), ''),
    eps = NULLIF(UPPER(BTRIM(eps)), '');

UPDATE public.administrador
SET
    nombres = UPPER(BTRIM(nombres)),
    apellidos = UPPER(BTRIM(apellidos));

UPDATE public.profiles
SET
    nombre = UPPER(BTRIM(nombre)),
    apellido = UPPER(BTRIM(apellido));

ALTER TABLE public.estudiantes
    ADD CONSTRAINT chk_estudiantes_coordinador
    CHECK (
        (coordinador_academico)::text = ANY (
            (ARRAY[
                'NICOL DELGADO'::character varying,
                'SANTIAGO DELGADO'::character varying,
                'DAVID DELGADO'::character varying,
                'ELENA MARTINEZ'::character varying
            ])::text[]
        )
    );

COMMIT;
