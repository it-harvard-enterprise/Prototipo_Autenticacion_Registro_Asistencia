


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."grado_enum" AS ENUM (
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    'T',
    'B'
);


ALTER TYPE "public"."grado_enum" OWNER TO "postgres";


CREATE TYPE "public"."metodo_pago_enum" AS ENUM (
    'EFECTIVO',
    'TRANSFERENCIA',
    'NEQUI',
    'DAVIPLATA',
    'OTRO'
);


ALTER TYPE "public"."metodo_pago_enum" OWNER TO "postgres";


CREATE TYPE "public"."role_enum" AS ENUM (
    'administrador',
    'estudiante',
    'profesor'
);


ALTER TYPE "public"."role_enum" OWNER TO "postgres";


CREATE TYPE "public"."saldo_enum" AS ENUM (
    'cancelado',
    'debe'
);


ALTER TYPE "public"."saldo_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."asignar_no_matricula"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.no_matricula IS NULL OR TRIM(NEW.no_matricula) = '' THEN
        NEW.no_matricula := 'MAT-' || LPAD(nextval('seq_no_matricula')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."asignar_no_matricula"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_uppercase_administrador"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.nombres := UPPER(BTRIM(NEW.nombres));
  NEW.apellidos := UPPER(BTRIM(NEW.apellidos));

  IF NEW.tipo_identificacion IS NOT NULL THEN
    NEW.tipo_identificacion := UPPER(BTRIM(NEW.tipo_identificacion));
  END IF;

  IF NEW.numero_identificacion IS NOT NULL THEN
    NEW.numero_identificacion := UPPER(BTRIM(NEW.numero_identificacion));
  END IF;

  IF NEW.email IS NOT NULL THEN
    NEW.email := UPPER(BTRIM(NEW.email));
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."force_uppercase_administrador"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_uppercase_cursos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.nombre_curso := UPPER(BTRIM(NEW.nombre_curso));
  NEW.nivel_curso := UPPER(BTRIM(NEW.nivel_curso));

  IF NEW.salon IS NOT NULL THEN
    NEW.salon := UPPER(BTRIM(NEW.salon));
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."force_uppercase_cursos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.administrador (id, nombres, apellidos)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nombres', ''),
        COALESCE(NEW.raw_user_meta_data->>'apellidos', '')
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role text;
  v_tipo_identificacion text;
  v_numero_identificacion text;
  v_localpart text;
BEGIN
  IF to_regclass('public.estudiantes') IS NOT NULL THEN
    UPDATE public.estudiantes
      SET auth_user_id = NEW.id
    WHERE auth_user_id IS NULL AND email = NEW.email;
  END IF;

  IF to_regclass('public.profesores') IS NOT NULL THEN
    UPDATE public.profesores
      SET auth_user_id = NEW.id
    WHERE auth_user_id IS NULL AND email = NEW.email;
  END IF;

  UPDATE public.administrador
    SET email = COALESCE(NULLIF(email, ''), NEW.email)
  WHERE id = NEW.id;

  v_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'rol', NEW.raw_user_meta_data->>'role', ''));

  IF v_role = 'administrador' THEN
    v_tipo_identificacion := UPPER(COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'tipo_identificacion'), ''), 'CC'));

    IF v_tipo_identificacion NOT IN ('CC', 'TI', 'CE', 'RCN', 'PAS', 'PPT') THEN
      v_tipo_identificacion := 'CC';
    END IF;

    v_numero_identificacion := NULLIF(BTRIM(NEW.raw_user_meta_data->>'numero_identificacion'), '');

    IF v_numero_identificacion IS NULL THEN
      v_localpart := REGEXP_REPLACE(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), '[^0-9A-Za-z]', '', 'g');

      IF v_localpart = '' THEN
        v_numero_identificacion := 'ADM-' || LEFT(REPLACE(NEW.id::text, '-', ''), 12);
      ELSE
        v_numero_identificacion := LEFT(v_localpart, 20);
      END IF;
    END IF;

    INSERT INTO public.administrador (
      id,
      tipo_identificacion,
      numero_identificacion,
      nombres,
      apellidos,
      email,
      role
    )
    VALUES (
      NEW.id,
      v_tipo_identificacion,
      v_numero_identificacion,
      COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'nombres'), ''), COALESCE(NEW.raw_user_meta_data->>'first_name', '')),
      COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'apellidos'), ''), COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
      NEW.email,
      'administrador'
    )
    ON CONFLICT (id) DO UPDATE
      SET tipo_identificacion = COALESCE(NULLIF(public.administrador.tipo_identificacion, ''), EXCLUDED.tipo_identificacion),
          numero_identificacion = COALESCE(NULLIF(public.administrador.numero_identificacion, ''), EXCLUDED.numero_identificacion),
          nombres = COALESCE(NULLIF(public.administrador.nombres, ''), EXCLUDED.nombres),
          apellidos = COALESCE(NULLIF(public.administrador.apellidos, ''), EXCLUDED.apellidos),
          email = COALESCE(NULLIF(public.administrador.email, ''), EXCLUDED.email),
          role = 'administrador';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_profile_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_approved_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'administrador'
      AND p.approved = true
  );
$$;


ALTER FUNCTION "public"."is_approved_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_last_modified_at_cursos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.last_modified_at := NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_last_modified_at_cursos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_cursos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at := NOW();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_cursos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_estudiantes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at := NOW();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_estudiantes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_profesores"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_profesores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_from_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  resolved_email text;
BEGIN
  resolved_email := COALESCE(
    NULLIF(NEW.email, ''),
    (SELECT u.email FROM auth.users u WHERE u.id = NEW.id),
    'admin+' || LEFT(NEW.id::text, 8) || '@example.com'
  );

  INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
  VALUES (
    NEW.id,
    NEW.nombres,
    NEW.apellidos,
    resolved_email,
    'administrador',
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        role = EXCLUDED.role;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_from_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_from_estudiante"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.auth_user_id IS NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
  VALUES (NEW.auth_user_id, NEW.nombres, NEW.apellidos, NEW.email, 'estudiante', TRUE)
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        approved = EXCLUDED.approved;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_from_estudiante"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_from_profesor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.auth_user_id IS NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
  VALUES (NEW.auth_user_id, NEW.nombres, NEW.apellidos, NEW.email, 'profesor', TRUE)
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        approved = EXCLUDED.approved;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_from_profesor"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."administrador" (
    "id" "uuid" NOT NULL,
    "nombres" character varying(100) NOT NULL,
    "apellidos" character varying(100) NOT NULL,
    "role" character varying(50) DEFAULT 'administrador'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_identificacion" character varying(20),
    "numero_identificacion" character varying(20),
    "email" character varying(200)
);


ALTER TABLE "public"."administrador" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cursos" (
    "id_curso" integer NOT NULL,
    "nombre_curso" character varying(150) NOT NULL,
    "nivel_curso" character varying(50) NOT NULL,
    "hora_inicio" time without time zone NOT NULL,
    "hora_fin" time without time zone NOT NULL,
    "salon" character varying(50),
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_fechas" CHECK (("fecha_fin" > "fecha_inicio")),
    CONSTRAINT "chk_horario" CHECK (("hora_fin" > "hora_inicio"))
);


ALTER TABLE "public"."cursos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cursos_id_curso_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cursos_id_curso_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cursos_id_curso_seq" OWNED BY "public"."cursos"."id_curso";



CREATE TABLE IF NOT EXISTS "public"."cursos_x_estudiantes" (
    "numero_identificacion" character varying(20) NOT NULL,
    "id_curso" integer NOT NULL,
    "fecha_inscripcion" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cursos_x_estudiantes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cursos_x_profesores" (
    "numero_identificacion" character varying(20) NOT NULL,
    "id_curso" integer NOT NULL,
    "fecha_inscripcion" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."cursos_x_profesores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estudiantes" (
    "numero_identificacion" character varying(20) NOT NULL,
    "no_matricula" character varying(20),
    "nombres" character varying(100) NOT NULL,
    "apellidos" character varying(100) NOT NULL,
    "grado" "public"."grado_enum" NOT NULL,
    "telefono" character varying(20) NOT NULL,
    "direccion" character varying(200) NOT NULL,
    "barrio" character varying(100) NOT NULL,
    "nombre_acudiente" character varying(200) NOT NULL,
    "telefono_acudiente" character varying(20) NOT NULL,
    "programa" character varying(100) NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_matricula" "date" NOT NULL,
    "valor_matricula" numeric(12,2) NOT NULL,
    "valor_apoyo_semanal" numeric(12,2) NOT NULL,
    "huella_indice_derecho" "text" NOT NULL,
    "huella_indice_izquierdo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_identificacion" character varying(20) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "coordinador_academico" character varying(100) NOT NULL,
    "medio_pago_matricula" "public"."metodo_pago_enum" NOT NULL,
    "eps" character varying(200) NOT NULL,
    "auth_user_id" "uuid",
    "email" character varying(200),
    CONSTRAINT "chk_estudiantes_eps" CHECK (("btrim"(("eps")::"text") <> ''::"text")),
    CONSTRAINT "chk_estudiantes_tipo_identificacion" CHECK ((("tipo_identificacion")::"text" = ANY ((ARRAY['CC'::character varying, 'TI'::character varying, 'CE'::character varying, 'RCN'::character varying, 'PAS'::character varying, 'PPT'::character varying])::"text"[]))),
    CONSTRAINT "estudiantes_huella_indice_derecho_check" CHECK (("btrim"("huella_indice_derecho") <> ''::"text")),
    CONSTRAINT "estudiantes_huella_indice_izquierdo_check" CHECK (("btrim"("huella_indice_izquierdo") <> ''::"text")),
    CONSTRAINT "estudiantes_tipo_identificacion_check" CHECK ((("tipo_identificacion")::"text" = ANY ((ARRAY['CC'::character varying, 'TI'::character varying, 'CE'::character varying, 'RCN'::character varying, 'PASAPORTE'::character varying, 'PAS'::character varying, 'PPT'::character varying])::"text"[])))
);


ALTER TABLE "public"."estudiantes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profesores" (
    "numero_identificacion" character varying(20) NOT NULL,
    "auth_user_id" "uuid",
    "tipo_identificacion" character varying(20) NOT NULL,
    "nombres" character varying(100) NOT NULL,
    "apellidos" character varying(100) NOT NULL,
    "telefono" character varying(20) NOT NULL,
    "direccion" character varying(200) NOT NULL,
    "barrio" character varying(100) NOT NULL,
    "nombre_contacto_emergencia" character varying(200) NOT NULL,
    "telefono_contacto_emergencia" character varying(20) NOT NULL,
    "eps" character varying(200) NOT NULL,
    "email" character varying(200) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_profesores_eps" CHECK (("btrim"(("eps")::"text") <> ''::"text")),
    CONSTRAINT "chk_profesores_tipo_identificacion" CHECK ((("tipo_identificacion")::"text" = ANY (ARRAY[('CC'::character varying)::"text", ('TI'::character varying)::"text", ('CE'::character varying)::"text", ('RCN'::character varying)::"text", ('PAS'::character varying)::"text", ('PPT'::character varying)::"text"])))
);


ALTER TABLE "public"."profesores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "apellido" character varying(100) NOT NULL,
    "email" character varying(200) NOT NULL,
    "role" "public"."role_enum" NOT NULL,
    "approved" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registro_asistencia" (
    "id" integer NOT NULL,
    "numero_identificacion" character varying(20) NOT NULL,
    "id_curso" integer NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asistio" boolean NOT NULL,
    "saldo" "public"."saldo_enum",
    "metodo_pago" "public"."metodo_pago_enum",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_metodo_pago" CHECK (((("saldo" = 'cancelado'::"public"."saldo_enum") AND ("metodo_pago" IS NOT NULL)) OR (("saldo" = 'debe'::"public"."saldo_enum") AND ("metodo_pago" IS NULL)) OR ("saldo" IS NULL))),
    CONSTRAINT "chk_saldo_asistencia" CHECK (((("asistio" = false) AND ("saldo" IS NULL) AND ("metodo_pago" IS NULL)) OR ("asistio" = true)))
);


ALTER TABLE "public"."registro_asistencia" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."registro_asistencia_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."registro_asistencia_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."registro_asistencia_id_seq" OWNED BY "public"."registro_asistencia"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."seq_no_matricula"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."seq_no_matricula" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vista_saldo_acumulado" WITH ("security_invoker"='true') AS
 SELECT "e"."numero_identificacion",
    "e"."nombres",
    "e"."apellidos",
    "e"."valor_matricula",
    "e"."valor_apoyo_semanal",
    "count"("ra"."id") FILTER (WHERE (("ra"."asistio" = true) AND ("ra"."saldo" = 'debe'::"public"."saldo_enum"))) AS "clases_pendientes_pago",
    "count"("ra"."id") FILTER (WHERE (("ra"."asistio" = true) AND ("ra"."saldo" = 'cancelado'::"public"."saldo_enum"))) AS "clases_pagadas",
    (("count"("ra"."id") FILTER (WHERE (("ra"."asistio" = true) AND ("ra"."saldo" = 'debe'::"public"."saldo_enum"))))::numeric * "e"."valor_apoyo_semanal") AS "saldo_acumulado_debe",
    ("e"."valor_matricula" + (("count"("ra"."id") FILTER (WHERE (("ra"."asistio" = true) AND ("ra"."saldo" = 'debe'::"public"."saldo_enum"))))::numeric * "e"."valor_apoyo_semanal")) AS "deuda_total_estimada"
   FROM ("public"."estudiantes" "e"
     LEFT JOIN "public"."registro_asistencia" "ra" ON ((("ra"."numero_identificacion")::"text" = ("e"."numero_identificacion")::"text")))
  GROUP BY "e"."numero_identificacion", "e"."nombres", "e"."apellidos", "e"."valor_matricula", "e"."valor_apoyo_semanal";


ALTER VIEW "public"."vista_saldo_acumulado" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vista_deuda_estudiantes" WITH ("security_invoker"='true') AS
 SELECT "numero_identificacion",
    "nombres",
    "apellidos",
    "valor_matricula",
    "valor_apoyo_semanal",
    "clases_pendientes_pago",
    "saldo_acumulado_debe",
    "deuda_total_estimada" AS "deuda_total"
   FROM "public"."vista_saldo_acumulado";


ALTER VIEW "public"."vista_deuda_estudiantes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cursos" ALTER COLUMN "id_curso" SET DEFAULT "nextval"('"public"."cursos_id_curso_seq"'::"regclass");



ALTER TABLE ONLY "public"."registro_asistencia" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."registro_asistencia_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."administrador"
    ADD CONSTRAINT "administrador_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."estudiantes"
    ADD CONSTRAINT "chk_estudiantes_coordinador" CHECK ((("coordinador_academico")::"text" = ANY (ARRAY[('NICOL DELGADO'::character varying)::"text", ('SANTIAGO DELGADO'::character varying)::"text", ('DAVID DELGADO'::character varying)::"text", ('ELENA MARTINEZ'::character varying)::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."cursos"
    ADD CONSTRAINT "cursos_pkey" PRIMARY KEY ("id_curso");



ALTER TABLE ONLY "public"."cursos_x_estudiantes"
    ADD CONSTRAINT "cursos_x_estudiantes_pkey" PRIMARY KEY ("numero_identificacion", "id_curso");



ALTER TABLE ONLY "public"."cursos_x_profesores"
    ADD CONSTRAINT "cursos_x_profesores_pkey" PRIMARY KEY ("numero_identificacion", "id_curso");



ALTER TABLE ONLY "public"."estudiantes"
    ADD CONSTRAINT "estudiantes_no_matricula_key" UNIQUE ("no_matricula");



ALTER TABLE ONLY "public"."estudiantes"
    ADD CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("numero_identificacion");



ALTER TABLE ONLY "public"."profesores"
    ADD CONSTRAINT "profesores_pkey" PRIMARY KEY ("numero_identificacion");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registro_asistencia"
    ADD CONSTRAINT "registro_asistencia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registro_asistencia"
    ADD CONSTRAINT "uq_asistencia" UNIQUE ("numero_identificacion", "id_curso", "fecha");



CREATE INDEX "idx_asistencia_curso" ON "public"."registro_asistencia" USING "btree" ("id_curso");



CREATE INDEX "idx_asistencia_estudiante" ON "public"."registro_asistencia" USING "btree" ("numero_identificacion");



CREATE INDEX "idx_asistencia_fecha" ON "public"."registro_asistencia" USING "btree" ("fecha");



CREATE INDEX "idx_cursos_x_estudiantes_curso" ON "public"."cursos_x_estudiantes" USING "btree" ("id_curso");



CREATE INDEX "idx_cursos_x_profesores_curso" ON "public"."cursos_x_profesores" USING "btree" ("id_curso");



CREATE INDEX "idx_estudiantes_email" ON "public"."estudiantes" USING "btree" ("email");



CREATE INDEX "idx_profesores_email" ON "public"."profesores" USING "btree" ("email");



CREATE UNIQUE INDEX "uq_estudiantes_auth_user_id" ON "public"."estudiantes" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_profesores_auth_user_id" ON "public"."profesores" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "trg_asignar_no_matricula" BEFORE INSERT ON "public"."estudiantes" FOR EACH ROW EXECUTE FUNCTION "public"."asignar_no_matricula"();



CREATE OR REPLACE TRIGGER "trg_force_uppercase_administrador" BEFORE INSERT OR UPDATE ON "public"."administrador" FOR EACH ROW EXECUTE FUNCTION "public"."force_uppercase_administrador"();



CREATE OR REPLACE TRIGGER "trg_force_uppercase_cursos" BEFORE INSERT OR UPDATE ON "public"."cursos" FOR EACH ROW EXECUTE FUNCTION "public"."force_uppercase_cursos"();



CREATE OR REPLACE TRIGGER "trg_set_last_modified_at_cursos" BEFORE UPDATE ON "public"."cursos" FOR EACH ROW EXECUTE FUNCTION "public"."set_last_modified_at_cursos"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at_cursos" BEFORE UPDATE ON "public"."cursos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_cursos"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at_estudiantes" BEFORE UPDATE ON "public"."estudiantes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_estudiantes"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at_profesores" BEFORE UPDATE ON "public"."profesores" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_profesores"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_profiles"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_admin" AFTER INSERT OR UPDATE ON "public"."administrador" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_from_admin"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_estudiante" AFTER INSERT OR UPDATE ON "public"."estudiantes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_from_estudiante"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_profesor" AFTER INSERT OR UPDATE ON "public"."profesores" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_from_profesor"();



ALTER TABLE ONLY "public"."administrador"
    ADD CONSTRAINT "administrador_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_x_estudiantes"
    ADD CONSTRAINT "cursos_x_estudiantes_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "public"."cursos"("id_curso") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_x_estudiantes"
    ADD CONSTRAINT "cursos_x_estudiantes_numero_identificacion_fkey" FOREIGN KEY ("numero_identificacion") REFERENCES "public"."estudiantes"("numero_identificacion") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_x_profesores"
    ADD CONSTRAINT "cursos_x_profesores_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "public"."cursos"("id_curso") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_x_profesores"
    ADD CONSTRAINT "cursos_x_profesores_numero_identificacion_fkey" FOREIGN KEY ("numero_identificacion") REFERENCES "public"."profesores"("numero_identificacion") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estudiantes"
    ADD CONSTRAINT "estudiantes_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profesores"
    ADD CONSTRAINT "profesores_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registro_asistencia"
    ADD CONSTRAINT "registro_asistencia_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "public"."cursos"("id_curso") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registro_asistencia"
    ADD CONSTRAINT "registro_asistencia_numero_identificacion_fkey" FOREIGN KEY ("numero_identificacion") REFERENCES "public"."estudiantes"("numero_identificacion") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE "public"."administrador" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cursos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cursos_x_estudiantes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cursos_x_profesores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estudiantes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "p_administrador_select_self" ON "public"."administrador" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "p_administrador_update_self" ON "public"."administrador" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "p_cursos_all_approved_admin" ON "public"."cursos" USING ("public"."is_approved_admin"()) WITH CHECK ("public"."is_approved_admin"());



CREATE POLICY "p_cursos_x_estudiantes_all_approved_admin" ON "public"."cursos_x_estudiantes" USING ("public"."is_approved_admin"()) WITH CHECK ("public"."is_approved_admin"());



CREATE POLICY "p_cursos_x_profesores_all_approved_admin" ON "public"."cursos_x_profesores" USING ("public"."is_approved_admin"()) WITH CHECK ("public"."is_approved_admin"());



CREATE POLICY "p_estudiantes_all_approved_admin" ON "public"."estudiantes" USING ("public"."is_approved_admin"()) WITH CHECK ("public"."is_approved_admin"());



CREATE POLICY "p_profesores_all_approved_admin" ON "public"."profesores" USING ("public"."is_approved_admin"()) WITH CHECK ("public"."is_approved_admin"());



CREATE POLICY "p_profesores_select_self" ON "public"."profesores" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "p_profiles_admin_all" ON "public"."profiles" USING ("public"."is_approved_admin"()) WITH CHECK ("public"."is_approved_admin"());



CREATE POLICY "p_profiles_select_self" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."is_approved_admin"()));



CREATE POLICY "p_registro_asistencia_all_approved_admin" ON "public"."registro_asistencia" USING ("public"."is_approved_admin"()) WITH CHECK ("public"."is_approved_admin"());



ALTER TABLE "public"."profesores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."registro_asistencia" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."asignar_no_matricula"() TO "anon";
GRANT ALL ON FUNCTION "public"."asignar_no_matricula"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."asignar_no_matricula"() TO "service_role";



GRANT ALL ON FUNCTION "public"."force_uppercase_administrador"() TO "anon";
GRANT ALL ON FUNCTION "public"."force_uppercase_administrador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_uppercase_administrador"() TO "service_role";



GRANT ALL ON FUNCTION "public"."force_uppercase_cursos"() TO "anon";
GRANT ALL ON FUNCTION "public"."force_uppercase_cursos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_uppercase_cursos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_profile_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile_link"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_approved_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_approved_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_approved_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_last_modified_at_cursos"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_last_modified_at_cursos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_last_modified_at_cursos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_cursos"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_cursos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_cursos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_estudiantes"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_estudiantes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_estudiantes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_profesores"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_profesores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_profesores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_from_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_from_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_from_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_from_estudiante"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_from_estudiante"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_from_estudiante"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_from_profesor"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_from_profesor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_from_profesor"() TO "service_role";



GRANT ALL ON TABLE "public"."administrador" TO "anon";
GRANT ALL ON TABLE "public"."administrador" TO "authenticated";
GRANT ALL ON TABLE "public"."administrador" TO "service_role";



GRANT ALL ON TABLE "public"."cursos" TO "anon";
GRANT ALL ON TABLE "public"."cursos" TO "authenticated";
GRANT ALL ON TABLE "public"."cursos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cursos_id_curso_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cursos_id_curso_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cursos_id_curso_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cursos_x_estudiantes" TO "anon";
GRANT ALL ON TABLE "public"."cursos_x_estudiantes" TO "authenticated";
GRANT ALL ON TABLE "public"."cursos_x_estudiantes" TO "service_role";



GRANT ALL ON TABLE "public"."cursos_x_profesores" TO "anon";
GRANT ALL ON TABLE "public"."cursos_x_profesores" TO "authenticated";
GRANT ALL ON TABLE "public"."cursos_x_profesores" TO "service_role";



GRANT ALL ON TABLE "public"."estudiantes" TO "anon";
GRANT ALL ON TABLE "public"."estudiantes" TO "authenticated";
GRANT ALL ON TABLE "public"."estudiantes" TO "service_role";



GRANT ALL ON TABLE "public"."profesores" TO "anon";
GRANT ALL ON TABLE "public"."profesores" TO "authenticated";
GRANT ALL ON TABLE "public"."profesores" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."registro_asistencia" TO "anon";
GRANT ALL ON TABLE "public"."registro_asistencia" TO "authenticated";
GRANT ALL ON TABLE "public"."registro_asistencia" TO "service_role";



GRANT ALL ON SEQUENCE "public"."registro_asistencia_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."registro_asistencia_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."registro_asistencia_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."seq_no_matricula" TO "anon";
GRANT ALL ON SEQUENCE "public"."seq_no_matricula" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."seq_no_matricula" TO "service_role";



GRANT ALL ON TABLE "public"."vista_saldo_acumulado" TO "anon";
GRANT ALL ON TABLE "public"."vista_saldo_acumulado" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_saldo_acumulado" TO "service_role";



GRANT ALL ON TABLE "public"."vista_deuda_estudiantes" TO "anon";
GRANT ALL ON TABLE "public"."vista_deuda_estudiantes" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_deuda_estudiantes" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







