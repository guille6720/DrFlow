-- Phase 14 — Storage security hardening for clinical-files.
-- Private bucket, path-kind coverage (export-staging + signatures), no UPDATE policy,
-- MIME allow-list restored for imports/exports. Staging/local only.

-- ---------------------------------------------------------------------------
-- Bucket: never public; complete MIME set for clinical + staging workflows
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 10485760),
  allowed_mime_types = ARRAY[
    'application/pdf',
    'text/csv',
    'application/octet-stream',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/fhir+json',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
WHERE id = 'clinical-files';

-- ---------------------------------------------------------------------------
-- Path classification: include export-staging and professional signatures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clinical_storage_path_kind(p_path text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_path ~ '^[^/]+/import-staging/' THEN 'staging'
    WHEN p_path ~ '^[^/]+/export-staging/' THEN 'staging'
    WHEN p_path ~ '^[^/]+/signatures/' THEN 'signature'
    WHEN p_path ~ '^[^/]+/[^/]+/admin/' THEN 'admin'
    WHEN p_path ~ '^[^/]+/patients/' THEN 'clinical'
    ELSE 'other'
  END;
$$;

CREATE OR REPLACE FUNCTION can_read_clinical_storage(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    is_superadmin()
    OR (
      clinical_file_clinic_id(p_path) IS NOT NULL
      AND CASE clinical_storage_path_kind(p_path)
        WHEN 'clinical' THEN can_view_clinical(clinical_file_clinic_id(p_path))
        WHEN 'admin' THEN can_manage_admin_docs(clinical_file_clinic_id(p_path))
        WHEN 'signature' THEN can_view_clinical(clinical_file_clinic_id(p_path))
        WHEN 'staging' THEN
          can_view_clinical(clinical_file_clinic_id(p_path))
          OR can_manage_clinic(clinical_file_clinic_id(p_path))
          OR can_manage_admin_docs(clinical_file_clinic_id(p_path))
        ELSE can_view_clinical(clinical_file_clinic_id(p_path))
      END
    );
$$;

CREATE OR REPLACE FUNCTION can_write_clinical_storage(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    is_superadmin()
    OR (
      clinical_file_clinic_id(p_path) IS NOT NULL
      AND CASE clinical_storage_path_kind(p_path)
        WHEN 'clinical' THEN can_write_clinical(clinical_file_clinic_id(p_path))
        WHEN 'admin' THEN can_manage_admin_docs(clinical_file_clinic_id(p_path))
        WHEN 'signature' THEN can_write_clinical(clinical_file_clinic_id(p_path))
        WHEN 'staging' THEN
          can_write_clinical(clinical_file_clinic_id(p_path))
          OR can_manage_clinic(clinical_file_clinic_id(p_path))
          OR can_manage_admin_docs(clinical_file_clinic_id(p_path))
        ELSE can_write_clinical(clinical_file_clinic_id(p_path))
      END
    );
$$;

-- Reaffirm SELECT / INSERT / DELETE (no UPDATE policy — blobs are immutable).
DROP POLICY IF EXISTS clinical_files_select ON storage.objects;
CREATE POLICY clinical_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'clinical-files'
    AND can_read_clinical_storage(name)
  );

DROP POLICY IF EXISTS clinical_files_insert ON storage.objects;
CREATE POLICY clinical_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinical-files'
    AND can_write_clinical_storage(name)
  );

DROP POLICY IF EXISTS clinical_files_delete ON storage.objects;
CREATE POLICY clinical_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinical-files'
    AND can_write_clinical_storage(name)
  );

DROP POLICY IF EXISTS clinical_files_update ON storage.objects;
-- Intentionally no UPDATE policy: replace via delete + insert / new UUID path.

COMMENT ON FUNCTION clinical_storage_path_kind IS
  'Phase 14: classify clinical-files paths (clinical/admin/staging/signature).';
COMMENT ON FUNCTION can_read_clinical_storage IS
  'Storage SELECT: path-aware clinic access; clinical files never public.';
COMMENT ON FUNCTION can_write_clinical_storage IS
  'Storage INSERT/DELETE: write gate; no object UPDATE policy.';
