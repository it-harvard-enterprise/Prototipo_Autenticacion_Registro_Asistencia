BEGIN;

ALTER TABLE public.course_material_folders
  ADD COLUMN IF NOT EXISTS parent_folder_id bigint;

ALTER TABLE public.course_material_folders
  DROP CONSTRAINT IF EXISTS course_material_folders_parent_folder_id_fkey;

ALTER TABLE public.course_material_folders
  ADD CONSTRAINT course_material_folders_parent_folder_id_fkey
  FOREIGN KEY (parent_folder_id)
  REFERENCES public.course_material_folders(id)
  ON DELETE CASCADE;

ALTER TABLE public.course_material_folders
  DROP CONSTRAINT IF EXISTS course_material_folders_parent_not_self_check;

ALTER TABLE public.course_material_folders
  ADD CONSTRAINT course_material_folders_parent_not_self_check
  CHECK (parent_folder_id IS NULL OR parent_folder_id <> id);

DROP INDEX IF EXISTS public.uq_course_material_folders_course_name_lower;

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_material_folders_course_parent_name_lower
  ON public.course_material_folders (id_curso, COALESCE(parent_folder_id, -1), lower(name::text));

COMMIT;
