BEGIN;

ALTER TABLE IF EXISTS public.cursos_x_estudiantes
    DROP CONSTRAINT IF EXISTS cursos_x_estudiantes_numero_identificacion_fkey;

ALTER TABLE IF EXISTS public.cursos_x_estudiantes
    ADD CONSTRAINT cursos_x_estudiantes_numero_identificacion_fkey
    FOREIGN KEY (numero_identificacion)
    REFERENCES public.estudiantes(numero_identificacion)
    ON UPDATE CASCADE
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.registro_asistencia
    DROP CONSTRAINT IF EXISTS registro_asistencia_numero_identificacion_fkey;

ALTER TABLE IF EXISTS public.registro_asistencia
    ADD CONSTRAINT registro_asistencia_numero_identificacion_fkey
    FOREIGN KEY (numero_identificacion)
    REFERENCES public.estudiantes(numero_identificacion)
    ON UPDATE CASCADE
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.cursos_x_profesores
    DROP CONSTRAINT IF EXISTS cursos_x_profesores_numero_identificacion_fkey;

ALTER TABLE IF EXISTS public.cursos_x_profesores
    ADD CONSTRAINT cursos_x_profesores_numero_identificacion_fkey
    FOREIGN KEY (numero_identificacion)
    REFERENCES public.profesores(numero_identificacion)
    ON UPDATE CASCADE
    ON DELETE CASCADE;

COMMIT;
