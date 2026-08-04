-- Phase 17: database audit — hot-path indexes, FK cascade fixes, schema documentation.
-- See DATABASE_REPORT.md for rationale and query mapping.

-- ---------------------------------------------------------------------------
-- Composite / partial indexes (loaders, reportes, portal, caja catalogs)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_patients_clinic_active_lastname
  ON patients (clinic_id, last_name, first_name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_created
  ON clinical_records (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_attachments_clinic_patient_filename
  ON patient_attachments (clinic_id, patient_id, file_name);

CREATE INDEX IF NOT EXISTS idx_patient_app_share_log_clinic_patient
  ON patient_app_share_log (clinic_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_clinic_created
  ON reminder_logs (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_clinic_status_created
  ON payments (clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_booking_links_clinic_active
  ON public_booking_links (clinic_id)
  WHERE is_active = true;

-- Caja module (034) may not be applied on all environments.
DO $$
BEGIN
  IF to_regclass('public.cash_charge_types') IS NOT NULL THEN
    EXECUTE
      'CREATE INDEX IF NOT EXISTS idx_cash_charge_types_clinic ON cash_charge_types (clinic_id)';
  END IF;
  IF to_regclass('public.cash_payment_methods') IS NOT NULL THEN
    EXECUTE
      'CREATE INDEX IF NOT EXISTS idx_cash_payment_methods_clinic ON cash_payment_methods (clinic_id)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinical_templates_clinic_active
  ON clinical_templates (clinic_id)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- FK cascade: appointment delete must not block clinical/billing artifacts
-- ---------------------------------------------------------------------------

ALTER TABLE clinical_records
  DROP CONSTRAINT IF EXISTS clinical_records_appointment_id_fkey;

ALTER TABLE clinical_records
  ADD CONSTRAINT clinical_records_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

ALTER TABLE reminder_logs
  DROP CONSTRAINT IF EXISTS reminder_logs_appointment_id_fkey;

ALTER TABLE reminder_logs
  ADD CONSTRAINT reminder_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_appointment_id_fkey;

ALTER TABLE payments
  ADD CONSTRAINT payments_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Schema documentation (no destructive drops)
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN patients.medical_history IS
  'DEPRECATED (047): canonical PHI in patient_clinical_profiles.medical_history. Column retained for compatibility.';
COMMENT ON COLUMN patients.allergies IS
  'DEPRECATED (047): canonical PHI in patient_clinical_profiles.allergies.';
COMMENT ON COLUMN patients.regular_medication IS
  'DEPRECATED (047): canonical PHI in patient_clinical_profiles.regular_medication.';
COMMENT ON COLUMN patients.notes IS
  'DEPRECATED (047): canonical PHI in patient_clinical_profiles.notes.';

DO $$
BEGIN
  IF to_regclass('public.clinical_record_attachments') IS NOT NULL THEN
    EXECUTE $comment$
      COMMENT ON TABLE clinical_record_attachments IS
        'Legacy per-consultation attachments. Application uses patient_attachments; table kept for RLS parity.'
    $comment$;
  END IF;
END $$;
