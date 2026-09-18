-- Ensure soft-archive RPC exists and PostgREST schema cache is refreshed.
-- Preview was failing delete with:
--   Could not find the function public.archive_clinical_record(...) in the schema cache
-- Lifecycle columns may already exist (from 131); this migration is idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'clinical_record_lifecycle_status'
  ) THEN
    CREATE TYPE clinical_record_lifecycle_status AS ENUM (
      'active',
      'archived',
      'superseded',
      'corrected'
    );
  END IF;
END $$;

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS lifecycle_status clinical_record_lifecycle_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT,
  ADD COLUMN IF NOT EXISTS record_version INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.archive_clinical_record(
  p_clinic_id UUID,
  p_record_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_lifecycle clinical_record_lifecycle_status DEFAULT 'archived'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_old clinical_records%ROWTYPE;
  v_new clinical_records%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT can_write_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_lifecycle NOT IN ('archived', 'superseded', 'corrected') THEN
    RAISE EXCEPTION 'INVALID_LIFECYCLE';
  END IF;

  SELECT * INTO v_old
  FROM clinical_records
  WHERE id = p_record_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECORD_NOT_FOUND';
  END IF;

  UPDATE clinical_records
  SET
    lifecycle_status = p_lifecycle,
    archived_at = now(),
    archived_by = v_uid,
    archive_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
    record_version = COALESCE(record_version, 1) + 1,
    updated_by = v_uid,
    updated_at = now()
  WHERE id = p_record_id AND clinic_id = p_clinic_id
  RETURNING * INTO v_new;

  INSERT INTO clinical_record_audit (
    clinical_record_id, clinic_id, patient_id, module, what, action,
    changed_by, old_values, new_values, change_reason
  )
  VALUES (
    p_record_id,
    p_clinic_id,
    v_new.patient_id,
    'clinical',
    CASE p_lifecycle
      WHEN 'corrected' THEN 'Marcó consulta como corregida (sin borrado físico)'
      WHEN 'superseded' THEN 'Marcó consulta como reemplazada (sin borrado físico)'
      ELSE 'Archivó consulta clínica (baja lógica)'
    END,
    'update'::audit_action,
    v_uid,
    to_jsonb(v_old),
    to_jsonb(v_new),
    NULLIF(trim(COALESCE(p_reason, '')), '')
  );

  RETURN to_jsonb(v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_clinical_record(
  UUID, UUID, TEXT, clinical_record_lifecycle_status
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_clinical_record(
  UUID, UUID, TEXT, clinical_record_lifecycle_status
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
