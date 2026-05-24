BEGIN;

DROP INDEX IF EXISTS public.uq_course_material_files_storage_path;

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_material_files_storage_path_non_youtube
  ON public.course_material_files (storage_path)
  WHERE COALESCE(content_type, ''::text) <> 'video/youtube'::text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_material_files_folder_youtube_url
  ON public.course_material_files (folder_id, storage_path)
  WHERE content_type = 'video/youtube'::text
    OR storage_bucket = 'youtube_link'::text;

COMMIT;
