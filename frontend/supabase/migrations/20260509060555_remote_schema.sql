alter table "public"."estudiantes" drop constraint "chk_estudiantes_tipo_identificacion";

alter table "public"."estudiantes" drop constraint "estudiantes_tipo_identificacion_check";

alter table "public"."estudiantes" add constraint "chk_estudiantes_tipo_identificacion" CHECK (((tipo_identificacion)::text = ANY ((ARRAY['CC'::character varying, 'TI'::character varying, 'CE'::character varying, 'RCN'::character varying, 'PAS'::character varying, 'PPT'::character varying])::text[]))) not valid;

alter table "public"."estudiantes" validate constraint "chk_estudiantes_tipo_identificacion";

alter table "public"."estudiantes" add constraint "estudiantes_tipo_identificacion_check" CHECK (((tipo_identificacion)::text = ANY ((ARRAY['CC'::character varying, 'TI'::character varying, 'CE'::character varying, 'RCN'::character varying, 'PASAPORTE'::character varying, 'PAS'::character varying, 'PPT'::character varying])::text[]))) not valid;

alter table "public"."estudiantes" validate constraint "estudiantes_tipo_identificacion_check";


