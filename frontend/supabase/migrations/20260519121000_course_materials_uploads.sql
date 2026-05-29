BEGIN;

CREATE OR REPLACE FUNCTION public.is_approved_admin_or_professor() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('administrador', 'profesor')
      AND p.approved = true
  );
$$;

CREATE TABLE IF NOT EXISTS public.course_material_course_settings (
  id_curso integer PRIMARY KEY,
  cover_storage_bucket text,
  cover_storage_path text,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT course_material_course_settings_id_curso_fkey
    FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE,
  CONSTRAINT course_material_course_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT course_material_cover_pair_check
    CHECK (
      (cover_storage_bucket IS NULL AND cover_storage_path IS NULL)
      OR (cover_storage_bucket IS NOT NULL AND cover_storage_path IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.course_material_folders (
  id bigserial PRIMARY KEY,
  id_curso integer NOT NULL,
  parent_folder_id bigint,
  name character varying(150) NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT course_material_folders_id_curso_fkey
    FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE,
  CONSTRAINT course_material_folders_parent_folder_id_fkey
    FOREIGN KEY (parent_folder_id) REFERENCES public.course_material_folders(id) ON DELETE CASCADE,
  CONSTRAINT course_material_folders_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT course_material_folders_name_check
    CHECK (btrim(name::text) <> ''::text),
  CONSTRAINT course_material_folders_parent_not_self_check
    CHECK (parent_folder_id IS NULL OR parent_folder_id <> id)
);

CREATE TABLE IF NOT EXISTS public.course_material_files (
  id bigserial PRIMARY KEY,
  id_curso integer NOT NULL,
  folder_id bigint NOT NULL,
  file_name text NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  content_type text,
  file_size bigint NOT NULL,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT course_material_files_id_curso_fkey
    FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE,
  CONSTRAINT course_material_files_folder_id_fkey
    FOREIGN KEY (folder_id) REFERENCES public.course_material_folders(id) ON DELETE CASCADE,
  CONSTRAINT course_material_files_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT course_material_files_file_name_check
    CHECK (btrim(file_name) <> ''::text),
  CONSTRAINT course_material_files_storage_bucket_check
    CHECK (btrim(storage_bucket) <> ''::text),
  CONSTRAINT course_material_files_storage_path_check
    CHECK (btrim(storage_path) <> ''::text),
  CONSTRAINT course_material_files_file_size_check
    CHECK (file_size > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_material_folders_course_parent_name_lower
  ON public.course_material_folders (id_curso, COALESCE(parent_folder_id, -1), lower(name::text));

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_material_files_storage_path
  ON public.course_material_files (storage_path);

CREATE INDEX IF NOT EXISTS idx_course_material_folders_course
  ON public.course_material_folders (id_curso);

CREATE INDEX IF NOT EXISTS idx_course_material_files_course
  ON public.course_material_files (id_curso);

CREATE INDEX IF NOT EXISTS idx_course_material_files_folder
  ON public.course_material_files (folder_id);

CREATE INDEX IF NOT EXISTS idx_course_material_files_created_at
  ON public.course_material_files (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_course_material_updated_at() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_material_folders_updated_at ON public.course_material_folders;
CREATE TRIGGER trg_course_material_folders_updated_at
  BEFORE UPDATE ON public.course_material_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_course_material_updated_at();

DROP TRIGGER IF EXISTS trg_course_material_settings_updated_at ON public.course_material_course_settings;
CREATE TRIGGER trg_course_material_settings_updated_at
  BEFORE UPDATE ON public.course_material_course_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_course_material_updated_at();

ALTER TABLE public.course_material_course_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_material_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_material_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_course_material_settings_select_authenticated ON public.course_material_course_settings;
CREATE POLICY p_course_material_settings_select_authenticated
  ON public.course_material_course_settings
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.approved = true
    )
  );

DROP POLICY IF EXISTS p_course_material_settings_manage ON public.course_material_course_settings;
CREATE POLICY p_course_material_settings_manage
  ON public.course_material_course_settings
  USING (public.is_approved_admin_or_professor())
  WITH CHECK (public.is_approved_admin_or_professor());

DROP POLICY IF EXISTS p_course_material_folders_select_authenticated ON public.course_material_folders;
CREATE POLICY p_course_material_folders_select_authenticated
  ON public.course_material_folders
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.approved = true
    )
  );

DROP POLICY IF EXISTS p_course_material_folders_manage ON public.course_material_folders;
CREATE POLICY p_course_material_folders_manage
  ON public.course_material_folders
  USING (public.is_approved_admin_or_professor())
  WITH CHECK (public.is_approved_admin_or_professor());

DROP POLICY IF EXISTS p_course_material_files_select_authenticated ON public.course_material_files;
CREATE POLICY p_course_material_files_select_authenticated
  ON public.course_material_files
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.approved = true
    )
  );

DROP POLICY IF EXISTS p_course_material_files_manage ON public.course_material_files;
CREATE POLICY p_course_material_files_manage
  ON public.course_material_files
  USING (public.is_approved_admin_or_professor())
  WITH CHECK (public.is_approved_admin_or_professor());

COMMIT;
