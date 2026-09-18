-- Backfill audit patient_id + enforce ownership on every INSERT.
-- Staging/production-safe: only fills NULL from parent clinical_records; rejects mismatches.

DROP TRIGGER IF EXISTS clinical_record_audit_immutable ON clinical_record_audit;

UPDATE clinical_record_audit a
SET patient_id = r.patient_id
FROM clinical_records r
WHERE a.clinical_record_id = r.id
  AND a.patient_id IS NULL
  AND a.clinic_id = r.clinic_id
  AND r.patient_id IS NOT NULL;

CREATE TRIGGER clinical_record_audit_immutable
  BEFORE UPDATE OR DELETE ON clinical_record_audit
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER IF EXISTS clinical_record_audit_insert_integrity ON clinical_record_audit;
CREATE TRIGGER clinical_record_audit_insert_integrity
  BEFORE INSERT ON clinical_record_audit
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_insert_integrity();

CREATE OR REPLACE FUNCTION public.enforce_audit_insert_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_record_patient UUID;
  v_record_clinic UUID;
BEGIN
  IF TG_TABLE_NAME = 'audit_logs' THEN
    NEW.created_at := now();
  ELSIF TG_TABLE_NAME = 'clinical_record_audit' THEN
    NEW.changed_at := now();

    SELECT cr.patient_id, cr.clinic_id
      INTO v_record_patient, v_record_clinic
    FROM clinical_records cr
    WHERE cr.id = NEW.clinical_record_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'AUDIT_RECORD_NOT_FOUND';
    END IF;

    IF NEW.clinic_id IS DISTINCT FROM v_record_clinic THEN
      RAISE EXCEPTION 'AUDIT_CLINIC_MISMATCH';
    END IF;

    IF v_record_patient IS NULL THEN
      RAISE EXCEPTION 'AUDIT_RECORD_MISSING_PATIENT';
    END IF;

    -- Never trust client-supplied patient_id when it disagrees with the parent HC row.
    IF NEW.patient_id IS NULL OR NEW.patient_id IS DISTINCT FROM v_record_patient THEN
      NEW.patient_id := v_record_patient;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_audit_insert_integrity IS
  'Server-owned audit timestamps; clinical_record_audit.patient_id derived from clinical_records.';

-- Preserve historical patient reference when audit rows exist.
ALTER TABLE clinical_record_audit
  DROP CONSTRAINT IF EXISTS clinical_record_audit_patient_id_fkey;

ALTER TABLE clinical_record_audit
  ADD CONSTRAINT clinical_record_audit_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT;

ALTER TABLE clinical_record_audit
  ALTER COLUMN patient_id SET NOT NULL;

NOTIFY pgrst, 'reload schema';
