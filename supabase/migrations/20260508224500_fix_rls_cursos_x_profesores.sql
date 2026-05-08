-- ============================================================
-- MIGRATION: Fix RLS for cursos_x_profesores
-- Allows approved admins to manage associations.
-- ============================================================

BEGIN;

ALTER TABLE IF EXISTS public.cursos_x_profesores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_cursos_x_profesores_all_approved_admin ON public.cursos_x_profesores;
CREATE POLICY p_cursos_x_profesores_all_approved_admin
    ON public.cursos_x_profesores
    FOR ALL
    USING (public.is_approved_admin())
    WITH CHECK (public.is_approved_admin());

COMMIT;
