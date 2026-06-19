-- Bucket privado para PDFs de historias clínicas y estudios del paciente.

ALTER TABLE patient_attachments
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otro'
  CHECK (category IN ('historia_clinica', 'estudio', 'otro'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-files',
  'clinical-files',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION clinical_file_clinic_id(p_path text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((string_to_array(p_path, '/'))[1], '')::uuid;
$$;

DROP POLICY IF EXISTS clinical_files_select ON storage.objects;
CREATE POLICY clinical_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'clinical-files'
    AND (
      is_superadmin()
      OR clinical_file_clinic_id(name) IN (SELECT user_clinic_ids())
    )
  );

DROP POLICY IF EXISTS clinical_files_insert ON storage.objects;
CREATE POLICY clinical_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinical-files'
    AND (
      is_superadmin()
      OR can_view_clinical(clinical_file_clinic_id(name))
    )
  );

DROP POLICY IF EXISTS clinical_files_delete ON storage.objects;
CREATE POLICY clinical_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinical-files'
    AND (
      is_superadmin()
      OR can_view_clinical(clinical_file_clinic_id(name))
    )
  );
