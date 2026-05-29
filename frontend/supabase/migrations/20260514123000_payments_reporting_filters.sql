BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'tipo_pago_enum'
      AND n.nspname = 'public'
  ) THEN
    ALTER TYPE public.tipo_pago_enum ADD VALUE IF NOT EXISTS 'pago_deuda';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'origen_pago_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.origen_pago_enum AS ENUM (
      'asistencia',
      'procesador'
    );
  END IF;
END;
$$;

ALTER TYPE public.origen_pago_enum ADD VALUE IF NOT EXISTS 'asistencia';
ALTER TYPE public.origen_pago_enum ADD VALUE IF NOT EXISTS 'procesador';

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS origen_pago public.origen_pago_enum;

UPDATE public.pagos
SET origen_pago = CASE
  WHEN id_asistencia IS NOT NULL THEN 'asistencia'::public.origen_pago_enum
  WHEN notas ILIKE 'PAGO REGISTRADO EN ASISTENCIA%' THEN 'asistencia'::public.origen_pago_enum
  ELSE 'procesador'::public.origen_pago_enum
END
WHERE origen_pago IS NULL;

ALTER TABLE public.pagos
  ALTER COLUMN origen_pago SET DEFAULT 'asistencia'::public.origen_pago_enum;

ALTER TABLE public.pagos
  ALTER COLUMN origen_pago SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_origen_pago
  ON public.pagos (origen_pago);

DROP VIEW IF EXISTS public.vista_reporte_pagos;

CREATE VIEW public.vista_reporte_pagos
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.fecha_pago,
  e.nombres || ' ' || e.apellidos AS estudiante,
  e.numero_identificacion,
  c.nombre_curso,
  p.origen_pago,
  p.tipo_pago,
  CASE
    WHEN p.tipo_pago = 'pago_deuda'::public.tipo_pago_enum THEN 'pago_deuda'
    WHEN p.tipo_pago = 'otro'::public.tipo_pago_enum
      AND COALESCE(p.notas, '') ILIKE 'PAGO DE DEUDA%' THEN 'pago_deuda'
    ELSE p.tipo_pago::text
  END AS tipo_pago_detalle,
  p.metodo_pago,
  p.valor,
  p.clases_adelantadas,
  p.registrado_por AS registrado_por_id,
  COALESCE(adm.nombre, '')
    || CASE WHEN adm.apellido IS NOT NULL THEN ' ' || adm.apellido ELSE '' END AS registrado_por,
  p.notas
FROM public.pagos p
JOIN public.estudiantes e
  ON e.numero_identificacion = p.numero_identificacion
LEFT JOIN public.cursos c
  ON c.id_curso = p.id_curso
LEFT JOIN public.profiles adm
  ON adm.id = p.registrado_por
ORDER BY p.fecha_pago DESC;

COMMIT;
