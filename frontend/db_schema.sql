-- ============================================================
-- SCHEMA: Escuela de Idiomas
-- Base de datos PostgreSQL / Supabase
-- ============================================================
-- INSTRUCCIONES DE EJECUCIÓN:
-- Pegar este archivo completo en el SQL Editor de Supabase
-- y ejecutarlo en orden. El schema auth ya existe en Supabase
-- y no necesita crearse manualmente.
-- ============================================================


-- ============================================================
-- PASO 1: TIPOS ENUM
-- ============================================================

CREATE TYPE metodo_pago_enum AS ENUM (
    'efectivo',
    'transferencia',
    'nequi',
    'daviplata',
    'otro'
);

CREATE TYPE saldo_enum AS ENUM (
    'cancelado',
    'debe'
);


-- ============================================================
-- PASO 2: TABLA: Administrador
-- Vinculada a auth.users de Supabase.
-- Email y password los gestiona Supabase Auth.
-- ============================================================

CREATE TABLE public.administrador (
    id          UUID            PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombres     VARCHAR(100)    NOT NULL,
    apellidos   VARCHAR(100)    NOT NULL,
    role        VARCHAR(50)     NOT NULL DEFAULT 'administrador',
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- PASO 3: FUNCIÓN Y TRIGGER para crear perfil automáticamente
-- Cuando Supabase Auth registra un nuevo usuario, este trigger
-- inserta automáticamente su fila en public.administrador.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.administrador (id, nombres, apellidos)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nombres', ''),
        COALESCE(NEW.raw_user_meta_data->>'apellidos', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PASO 4: TABLA: Estudiantes
-- ============================================================

CREATE TABLE public.estudiantes (
    numero_identificacion       VARCHAR(20)     PRIMARY KEY,
    no_matricula                VARCHAR(20)     UNIQUE,
    nombres                     VARCHAR(100)    NOT NULL,
    apellidos                   VARCHAR(100)    NOT NULL,
    grado                       SMALLINT        NOT NULL CHECK (grado BETWEEN 1 AND 11),
    telefono                    VARCHAR(20),
    direccion                   VARCHAR(200),
    barrio                      VARCHAR(100),
    nombre_acudiente            VARCHAR(200),
    telefono_acudiente          VARCHAR(20),
    programa                    VARCHAR(100),
    fecha_inicio                DATE,
    fecha_matricula             DATE,
    valor_matricula             NUMERIC(12, 2),
    matricula_cancelada         BOOLEAN         NOT NULL DEFAULT FALSE,
    valor_apoyo_semanal         NUMERIC(12, 2)  NOT NULL,
    huella_indice_derecho       TEXT,
    huella_indice_izquierdo     TEXT,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- PASO 5: SECUENCIA Y TRIGGER para no_matricula automático
-- Si el administrador deja no_matricula vacío, el sistema
-- asigna MAT-000001, MAT-000002, etc. automáticamente.
-- ============================================================

CREATE SEQUENCE seq_no_matricula START 1;

CREATE OR REPLACE FUNCTION public.asignar_no_matricula()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.no_matricula IS NULL OR TRIM(NEW.no_matricula) = '' THEN
        NEW.no_matricula := 'MAT-' || LPAD(nextval('seq_no_matricula')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asignar_no_matricula
    BEFORE INSERT ON public.estudiantes
    FOR EACH ROW
    EXECUTE FUNCTION public.asignar_no_matricula();


-- ============================================================
-- PASO 6: TABLA: Cursos
-- ============================================================

CREATE TABLE public.cursos (
    id_curso        SERIAL          PRIMARY KEY,
    nombre_curso    VARCHAR(150)    NOT NULL,
    nivel_curso     VARCHAR(50)     NOT NULL,
    hora_inicio     TIME            NOT NULL,
    hora_fin        TIME            NOT NULL,
    salon           VARCHAR(50),
    fecha_inicio    DATE            NOT NULL,
    fecha_fin       DATE            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_horario CHECK (hora_fin > hora_inicio),
    CONSTRAINT chk_fechas  CHECK (fecha_fin > fecha_inicio)
);


-- ============================================================
-- PASO 7: TABLA: CursosxEstudiantes (junction table)
-- ============================================================

CREATE TABLE public.cursos_x_estudiantes (
    numero_identificacion   VARCHAR(20)     NOT NULL REFERENCES public.estudiantes(numero_identificacion) ON DELETE CASCADE,
    id_curso                INTEGER         NOT NULL REFERENCES public.cursos(id_curso) ON DELETE CASCADE,
    fecha_inscripcion       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    PRIMARY KEY (numero_identificacion, id_curso)
);


-- ============================================================
-- PASO 8: TABLA: Registro_Asistencia
-- ============================================================

CREATE TABLE public.registro_asistencia (
    id                      SERIAL              PRIMARY KEY,
    numero_identificacion   VARCHAR(20)         NOT NULL REFERENCES public.estudiantes(numero_identificacion) ON DELETE CASCADE,
    id_curso                INTEGER             NOT NULL REFERENCES public.cursos(id_curso) ON DELETE CASCADE,
    fecha                   TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    asistio                 BOOLEAN             NOT NULL,
    saldo                   saldo_enum,
    metodo_pago             metodo_pago_enum,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_asistencia UNIQUE (numero_identificacion, id_curso, fecha),

    CONSTRAINT chk_saldo_asistencia
        CHECK (
            (asistio = FALSE AND saldo IS NULL AND metodo_pago IS NULL)
            OR
            (asistio = TRUE)
        ),

    CONSTRAINT chk_metodo_pago
        CHECK (
            (saldo = 'cancelado' AND metodo_pago IS NOT NULL)
            OR
            (saldo = 'debe'      AND metodo_pago IS NULL)
            OR
            (saldo IS NULL)
        )
);


-- ============================================================
-- PASO 9: ÍNDICES
-- ============================================================

CREATE INDEX idx_asistencia_estudiante
    ON public.registro_asistencia(numero_identificacion);

CREATE INDEX idx_asistencia_curso
    ON public.registro_asistencia(id_curso);

CREATE INDEX idx_asistencia_fecha
    ON public.registro_asistencia(fecha);

CREATE INDEX idx_cursos_x_estudiantes_curso
    ON public.cursos_x_estudiantes(id_curso);


-- ============================================================
-- PASO 10: VISTA — Saldo acumulado por estudiante
-- Siempre calculado en tiempo real. No se guarda en la tabla.
-- Consultar con: SELECT * FROM vista_saldo_acumulado;
-- o filtrar:     SELECT * FROM vista_saldo_acumulado
--                WHERE numero_identificacion = '123456';
-- ============================================================

CREATE VIEW public.vista_saldo_acumulado AS
SELECT
    e.numero_identificacion,
    e.nombres,
    e.apellidos,
    e.valor_apoyo_semanal,
    COUNT(ra.id) FILTER (WHERE ra.asistio = TRUE AND ra.saldo = 'debe')
        AS clases_pendientes_pago,
    COUNT(ra.id) FILTER (WHERE ra.asistio = TRUE AND ra.saldo = 'cancelado')
        AS clases_pagadas,
    COUNT(ra.id) FILTER (WHERE ra.asistio = TRUE AND ra.saldo = 'debe')
        * e.valor_apoyo_semanal
        AS saldo_acumulado_debe
FROM public.estudiantes e
LEFT JOIN public.registro_asistencia ra
    ON ra.numero_identificacion = e.numero_identificacion
GROUP BY
    e.numero_identificacion,
    e.nombres,
    e.apellidos,
    e.valor_apoyo_semanal;