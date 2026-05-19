BEGIN;

ALTER TABLE public.course_material_folders
  ADD COLUMN IF NOT EXISTS card_storage_bucket text,
  ADD COLUMN IF NOT EXISTS card_storage_path text;

ALTER TABLE public.course_material_folders
  DROP CONSTRAINT IF EXISTS course_material_folders_card_pair_check;

ALTER TABLE public.course_material_folders
  ADD CONSTRAINT course_material_folders_card_pair_check
  CHECK (
    (card_storage_bucket IS NULL AND card_storage_path IS NULL)
    OR (
      card_storage_bucket IS NOT NULL
      AND card_storage_path IS NOT NULL
      AND btrim(card_storage_bucket) <> ''::text
      AND btrim(card_storage_path) <> ''::text
    )
  );

COMMIT;
