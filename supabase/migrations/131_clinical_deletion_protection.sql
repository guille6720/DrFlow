-- Phase 7 — Clinical record deletion protection (Argentina compliance)
-- Hard DELETE of HC is forbidden unless migration purge RPC sets a transaction GUC.
-- Prefer lifecycle: active | archived | superseded | corrected.
-- Privacy / habeas data requests must NOT auto-destroy retained clinical records.

-- ---------------------------------------------------------------------------
-- Lifecycle / soft-archive columns on clinical_records
-- ---------------------------------------------------------------------------
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
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

COMMENT ON COLUMN clinical_records.lifecycle_status IS
  'Soft lifecycle: active (default), archived, superseded, corrected. Never hard-deleted for legal retention.';
COMMENT ON COLUMN clinical_records.archived_at IS
  'When the record was archived (soft removal from routine UI). Clinical content remains.';
COMMENT ON COLUMN clinical_records.archive_reason IS
  'Reason for archive — does not authorize physical destruction.';

CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_lifecycle
  ON clinical_records (clinic_id, lifecycle_status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Allow migration purge via transaction-local GUC (also unlocks audit immutability)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.allow_clinical_hard_delete', true), 'false') = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    -- Still never allow UPDATE of audit rows, even during purge.
    RAISE EXCEPTION 'Los registros de auditoría no pueden modificarse';
  END IF;

  RAISE EXCEPTION 'Los registros de auditoría no pueden modificarse ni eliminarse';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_clinical_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.allow_clinical_hard_delete', true), 'false') = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'CLINICAL_HARD_DELETE_FORBIDDEN: Hard delete of clinical data is blocked. Use archive/lifecycle status or the migration purge RPC. Privacy requests do not authorize destruction of retained HC (Ley 26.529).'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_clinical_records_hard_delete ON clinical_records;
CREATE TRIGGER trg_prevent_clinical_records_hard_delete
  BEFORE DELETE ON clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_clinical_hard_delete();

-- Issued / numbered prescriptions must not be hard-deleted (drafts OK)
CREATE OR REPLACE FUNCTION public.prevent_issued_prescription_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.allow_clinical_hard_delete', true), 'false') = 'true' THEN
    RETURN OLD;
  END IF;

  IF COALESCE(OLD.status, 'draft') IS DISTINCT FROM 'draft'
     OR OLD.prescription_number IS NOT NULL
     OR OLD.issued_at IS NOT NULL THEN
    RAISE EXCEPTION
      'ISSUED_PRESCRIPTION_DELETE_FORBIDDEN: Issued or numbered prescriptions cannot be hard-deleted. Void/supersede instead.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_issued_prescription_hard_delete ON prescription_drafts;
CREATE TRIGGER trg_prevent_issued_prescription_hard_delete
  BEFORE DELETE ON prescription_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_issued_prescription_hard_delete();

-- ---------------------------------------------------------------------------
-- Soft archive RPC (authenticated, clinic-scoped)
-- ---------------------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION public.archive_clinical_record(UUID, UUID, TEXT, clinical_record_lifecycle_status)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Migration-only purge (service_role). App MUST also require env gate.
-- Confirm phrase matches CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE in app.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_clinic_clinical_data_for_migration(
  p_clinic_id UUID,
  p_confirm_phrase TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_records INT := 0;
  v_attachments INT := 0;
  v_prescriptions INT := 0;
BEGIN
  -- Must match CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE in src/lib/constants/migration-reset.ts
  IF p_confirm_phrase IS DISTINCT FROM 'BORRAR HISTORIAS' THEN
    RAISE EXCEPTION 'CONFIRMATION_REQUIRED';
  END IF;

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_REQUIRED';
  END IF;

  -- Transaction-local: unlocks clinical + audit DELETE triggers for this RPC only.
  PERFORM set_config('app.allow_clinical_hard_delete', 'true', true);

  IF to_regclass('public.patient_attachments') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM patient_attachments WHERE clinic_id = $1'
      INTO v_attachments
      USING p_clinic_id;
    EXECUTE 'DELETE FROM patient_attachments WHERE clinic_id = $1'
      USING p_clinic_id;
  END IF;

  SELECT COUNT(*) INTO v_prescriptions
  FROM prescription_drafts WHERE clinic_id = p_clinic_id;
  DELETE FROM prescription_drafts WHERE clinic_id = p_clinic_id;

  SELECT COUNT(*) INTO v_records
  FROM clinical_records WHERE clinic_id = p_clinic_id;

  -- Cascades to clinical_record_audit (allowed while GUC is true)
  DELETE FROM clinical_records WHERE clinic_id = p_clinic_id;

  RETURN jsonb_build_object(
    'clinical_records_deleted', v_records,
    'attachments_deleted', v_attachments,
    'prescription_drafts_deleted', v_prescriptions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_clinic_clinical_data_for_migration(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_clinic_clinical_data_for_migration(UUID, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.purge_clinic_clinical_data_for_migration(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.purge_clinic_clinical_data_for_migration(UUID, TEXT) TO service_role;
