-- Referential integrity hardening (060): orphan repair, missing FKs, cascade alignment.
-- Idempotent — safe to re-run. No business-row DELETE; only NULL/sync fixes.
-- See SCHEMA_REFERENTIAL_INTEGRITY_REPORT.md

-- ---------------------------------------------------------------------------
-- 0. Prerequisites (columns from 047/048/055/057 — safe if already applied)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.patient_clinical_profiles') IS NULL THEN
    CREATE TABLE patient_clinical_profiles (
      patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      medical_history TEXT,
      allergies TEXT,
      regular_medication TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE clinic_members
  ADD COLUMN IF NOT EXISTS professional_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clinic_members_professional_id_fkey'
  ) THEN
    ALTER TABLE clinic_members
      ADD CONSTRAINT clinic_members_professional_id_fkey
      FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinic_members_professional
  ON clinic_members(professional_id)
  WHERE professional_id IS NOT NULL;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF to_regclass('public.clinical_record_audit') IS NOT NULL THEN
    ALTER TABLE clinical_record_audit
      ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Repair cross-tenant clinic_id drift (patient children must match patients.clinic_id)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'patient_attachments',
      'patient_admin_documents',
      'clinical_records',
      'prescription_drafts',
      'medical_orders',
      'appointments',
      'consent_records',
      'patient_app_share_log',
      'patient_clinical_profiles',
      'cash_charges',
      'patient_ledger_entries',
      'cash_invoices'
    ]) AS tbl
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      $sql$
      UPDATE %I child
      SET clinic_id = p.clinic_id
      FROM patients p
      WHERE child.patient_id = p.id
        AND child.clinic_id IS DISTINCT FROM p.clinic_id
      $sql$,
      r.tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. NULL dangling FKs (preserve rows; drop broken pointers)
-- ---------------------------------------------------------------------------
UPDATE clinical_records cr
SET appointment_id = NULL,
    updated_at = now()
WHERE cr.appointment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.id = cr.appointment_id);

UPDATE prescription_drafts pd
SET clinical_record_id = NULL,
    updated_at = now()
WHERE pd.clinical_record_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clinical_records cr WHERE cr.id = pd.clinical_record_id
  );

UPDATE clinical_records cr
SET template_id = NULL,
    updated_at = now()
WHERE cr.template_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clinical_templates t WHERE t.id = cr.template_id);

UPDATE appointments a
SET rescheduled_from = NULL,
    updated_at = now()
WHERE a.rescheduled_from IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM appointments b WHERE b.id = a.rescheduled_from);

UPDATE clinic_members cm
SET professional_id = NULL,
    updated_at = now()
WHERE cm.professional_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = cm.professional_id
      AND p.clinic_id = cm.clinic_id
  );

UPDATE public_booking_links pbl
SET professional_id = NULL
WHERE pbl.professional_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = pbl.professional_id
      AND p.clinic_id = pbl.clinic_id
  );

UPDATE audit_logs al
SET patient_id = NULL
WHERE al.patient_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = al.patient_id);

DO $$
BEGIN
  IF to_regclass('public.clinical_record_audit') IS NOT NULL THEN
    UPDATE clinical_record_audit cra
    SET patient_id = NULL
    WHERE cra.patient_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = cra.patient_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Missing FK: clinical_records.template_id → clinical_templates
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE clinical_records
    ADD CONSTRAINT clinical_records_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES clinical_templates(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 4. FK cascade / ON DELETE alignment (drop + re-add idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE prescription_drafts
  DROP CONSTRAINT IF EXISTS prescription_drafts_clinical_record_id_fkey;
ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_clinical_record_id_fkey
  FOREIGN KEY (clinical_record_id) REFERENCES clinical_records(id) ON DELETE SET NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_patient_id_fkey;
ALTER TABLE payments
  ADD CONSTRAINT payments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_location_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_specialty_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_specialty_id_fkey
  FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE SET NULL;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_consultation_reason_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_consultation_reason_id_fkey
  FOREIGN KEY (consultation_reason_id) REFERENCES consultation_reasons(id) ON DELETE SET NULL;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_rescheduled_from_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_rescheduled_from_fkey
  FOREIGN KEY (rescheduled_from) REFERENCES appointments(id) ON DELETE SET NULL;

ALTER TABLE availability_rules
  DROP CONSTRAINT IF EXISTS availability_rules_location_id_fkey;
ALTER TABLE availability_rules
  ADD CONSTRAINT availability_rules_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

ALTER TABLE public_booking_links
  DROP CONSTRAINT IF EXISTS public_booking_links_professional_id_fkey;
ALTER TABLE public_booking_links
  ADD CONSTRAINT public_booking_links_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE SET NULL;

-- Caja module (034) — optional catalog FKs
DO $$
BEGIN
  IF to_regclass('public.cash_charges') IS NOT NULL THEN
    ALTER TABLE cash_charges DROP CONSTRAINT IF EXISTS cash_charges_charge_type_id_fkey;
    ALTER TABLE cash_charges
      ADD CONSTRAINT cash_charges_charge_type_id_fkey
      FOREIGN KEY (charge_type_id) REFERENCES cash_charge_types(id) ON DELETE SET NULL;

    ALTER TABLE cash_charges DROP CONSTRAINT IF EXISTS cash_charges_payment_method_id_fkey;
    ALTER TABLE cash_charges
      ADD CONSTRAINT cash_charges_payment_method_id_fkey
      FOREIGN KEY (payment_method_id) REFERENCES cash_payment_methods(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Tenant-consistency triggers (INSERT/UPDATE guard — no data loss)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_patient_clinic_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_patient_clinic UUID;
BEGIN
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT clinic_id INTO v_patient_clinic
  FROM patients
  WHERE id = NEW.patient_id;

  IF v_patient_clinic IS NULL THEN
    RAISE EXCEPTION 'patient_id % does not exist', NEW.patient_id;
  END IF;

  IF NEW.clinic_id IS DISTINCT FROM v_patient_clinic THEN
    NEW.clinic_id := v_patient_clinic;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'patient_attachments',
      'patient_admin_documents',
      'clinical_records',
      'prescription_drafts',
      'medical_orders',
      'consent_records',
      'patient_app_share_log'
    ]) AS tbl
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_patient_clinic ON %I', r.tbl, r.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_patient_clinic
       BEFORE INSERT OR UPDATE OF patient_id, clinic_id ON %I
       FOR EACH ROW EXECUTE FUNCTION enforce_patient_clinic_consistency()',
      r.tbl,
      r.tbl
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION enforce_clinic_member_professional()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.professional_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = NEW.professional_id
      AND p.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'professional_id must belong to clinic_id %', NEW.clinic_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_members_professional_clinic ON clinic_members;
CREATE TRIGGER trg_clinic_members_professional_clinic
  BEFORE INSERT OR UPDATE OF professional_id, clinic_id ON clinic_members
  FOR EACH ROW EXECUTE FUNCTION enforce_clinic_member_professional();

-- ---------------------------------------------------------------------------
-- 6. Integrity verification (run after migration — returns 0 rows when clean)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_referential_integrity()
RETURNS TABLE(check_name TEXT, violation_count BIGINT)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'patient_clinic_mismatch'::TEXT, COUNT(*)::BIGINT
  FROM patient_attachments pa
  JOIN patients p ON p.id = pa.patient_id
  WHERE pa.clinic_id IS DISTINCT FROM p.clinic_id;

  RETURN QUERY
  SELECT 'clinical_record_orphan_appointment'::TEXT, COUNT(*)::BIGINT
  FROM clinical_records cr
  WHERE cr.appointment_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.id = cr.appointment_id);

  RETURN QUERY
  SELECT 'prescription_orphan_clinical_record'::TEXT, COUNT(*)::BIGINT
  FROM prescription_drafts pd
  WHERE pd.clinical_record_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM clinical_records cr WHERE cr.id = pd.clinical_record_id);

  RETURN QUERY
  SELECT 'clinical_record_orphan_template'::TEXT, COUNT(*)::BIGINT
  FROM clinical_records cr
  WHERE cr.template_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM clinical_templates t WHERE t.id = cr.template_id);

  RETURN QUERY
  SELECT 'clinic_member_cross_clinic_professional'::TEXT, COUNT(*)::BIGINT
  FROM clinic_members cm
  WHERE cm.professional_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = cm.professional_id AND p.clinic_id = cm.clinic_id
    );

  RETURN QUERY
  SELECT 'audit_log_orphan_patient'::TEXT, COUNT(*)::BIGINT
  FROM audit_logs al
  WHERE al.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = al.patient_id);
END;
$$;

COMMENT ON FUNCTION verify_referential_integrity IS
  'Post-migration integrity checks. All violation_count should be 0.';

GRANT EXECUTE ON FUNCTION verify_referential_integrity() TO authenticated;
