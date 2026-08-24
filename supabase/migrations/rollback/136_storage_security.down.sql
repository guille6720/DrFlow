-- ROLLBACK 136_storage_security (PARTIAL — staging/local only).
-- Re-opens path kinds to a simpler classifier; keeps bucket private (safer).
-- Full policy restore may require re-applying earlier storage migration from git.
-- DO NOT run on production without an explicit ops runbook.

CREATE OR REPLACE FUNCTION clinical_storage_path_kind(p_path text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_path ~ '^[^/]+/import-staging/' THEN 'staging'
    WHEN p_path ~ '^[^/]+/[^/]+/admin/' THEN 'admin'
    WHEN p_path ~ '^[^/]+/patients/' THEN 'clinical'
    ELSE 'other'
  END;
$$;

-- Keep public = false (do not re-publicize clinical-files on rollback).
UPDATE storage.buckets
SET public = false
WHERE id = 'clinical-files';
