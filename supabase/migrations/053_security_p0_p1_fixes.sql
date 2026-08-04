-- P0/P1 security fixes: audit_logs INSERT, clinical_record_attachments writes,
-- storage path-aware policies (admin/staging/clinical), clinic_jobs INSERT roles,
-- bucket MIME types for imports.

-- ---------------------------------------------------------------------------
-- Storage path classification
-- ---------------------------------------------------------------------------
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
        WHEN 'staging' THEN
          can_write_clinical(clinical_file_clinic_id(p_path))
          OR can_manage_clinic(clinical_file_clinic_id(p_path))
          OR can_manage_admin_docs(clinical_file_clinic_id(p_path))
        ELSE can_write_clinical(clinical_file_clinic_id(p_path))
      END
    );
$$;

-- ---------------------------------------------------------------------------
-- Storage policies (path-aware read/write)
-- ---------------------------------------------------------------------------
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

-- Allow CSV/staging uploads used by HCE and batch imports
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'text/csv',
  'application/octet-stream'
]::text[]
WHERE id = 'clinical-files';

-- ---------------------------------------------------------------------------
-- audit_logs: tenant-scoped INSERT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND (
      is_superadmin()
      OR (
        clinic_id IS NOT NULL
        AND clinic_id IN (SELECT user_clinic_ids())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- clinical_record_attachments: subscription-gated writes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS clinical_record_attachments_all ON clinical_record_attachments;

CREATE POLICY clinical_record_attachments_select ON clinical_record_attachments FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));

CREATE POLICY clinical_record_attachments_insert ON clinical_record_attachments FOR INSERT
  WITH CHECK (is_superadmin() OR can_write_clinical(clinic_id));

CREATE POLICY clinical_record_attachments_update ON clinical_record_attachments FOR UPDATE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

CREATE POLICY clinical_record_attachments_delete ON clinical_record_attachments FOR DELETE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

-- ---------------------------------------------------------------------------
-- clinic_jobs: staff roles only (not patient)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS clinic_jobs_insert ON clinic_jobs;
CREATE POLICY clinic_jobs_insert ON clinic_jobs FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR (
      clinic_id IN (SELECT user_clinic_ids())
      AND user_role_in_clinic(clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

COMMENT ON FUNCTION can_read_clinical_storage IS 'Storage SELECT: clinical/admin/staging path-aware access.';
COMMENT ON FUNCTION can_write_clinical_storage IS 'Storage INSERT/DELETE: write gate aligned with can_write_clinical / admin docs.';
