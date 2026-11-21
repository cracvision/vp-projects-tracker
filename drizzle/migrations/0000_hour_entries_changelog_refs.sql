CREATE OR REPLACE FUNCTION public.valid_changelog_refs(refs text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(array_length(refs, 1), 0) <= 10
     AND NOT EXISTS (
       SELECT 1 FROM unnest(refs) r
        WHERE r IS NULL OR char_length(r) < 1 OR char_length(r) > 255 OR r ~ E'[\\r\\n]'
     )
$$;

ALTER TABLE public.hour_entries
  ADD COLUMN IF NOT EXISTS changelog_refs text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.hour_entries DROP CONSTRAINT IF EXISTS hour_entries_changelog_refs_valid;
ALTER TABLE public.hour_entries
  ADD CONSTRAINT hour_entries_changelog_refs_valid CHECK (public.valid_changelog_refs(changelog_refs));

CREATE UNIQUE INDEX IF NOT EXISTS hour_entries_owner_project_date_key
  ON public.hour_entries (owner_uid, project_id, work_date);