-- Phase 18: index optimization — drop duplicates, add FK + hot-path indexes, pg_trgm search.
-- Idempotent. See INDEX_AUDIT_REPORT.md for query mapping and Seq Scan analysis.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Drop duplicate / redundant indexes
-- ---------------------------------------------------------------------------

-- Exact duplicate of idx_clinical_records_clinic_created (045 vs 054).
DROP INDEX IF EXISTS idx_clinical_records_clinic;

-- UNIQUE (clinic_id, document_number) already provides this B-tree.
DROP INDEX IF EXISTS idx_patients_document;

-- PK (clinic_id, plugin_id) / (clinic_id, flag_id) already index clinic_id prefix.
DROP INDEX IF EXISTS idx_clinic_plugins_clinic;
DROP INDEX IF EXISTS idx_clinic_feature_flags_clinic;

-- Strict subset of idx_patient_app_share_log_clinic_patient (054).
DROP INDEX IF EXISTS patient_app_share_log_clinic_idx;

-- ---------------------------------------------------------------------------
-- 2. pg_trgm — patient ILIKE search (pacientes, historias, command palette)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_patients_first_name_trgm
  ON patients USING gin (first_name gin_trgm_ops)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_patients_last_name_trgm
  ON patients USING gin (last_name gin_trgm_ops)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_patients_document_trgm
  ON patients USING gin (document_number gin_trgm_ops)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 3. FK columns — JOIN, CASCADE, orphan repair (060), DELETE checks
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_clinical_records_appointment
  ON clinical_records (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescription_drafts_clinical_record
  ON prescription_drafts (clinical_record_id)
  WHERE clinical_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medical_orders_clinical_record
  ON medical_orders (clinical_record_id)
  WHERE clinical_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_appointment
  ON payments (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_patient
  ON payments (patient_id);

CREATE INDEX IF NOT EXISTS idx_telemedicine_sessions_appointment
  ON telemedicine_sessions (appointment_id);

CREATE INDEX IF NOT EXISTS idx_professionals_user
  ON professionals (user_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Hot-path query indexes (mapped from src/ loaders and RPCs)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_professionals_clinic_active_name
  ON professionals (clinic_id, display_name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_availability_rules_clinic_professional
  ON availability_rules (clinic_id, professional_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_clinic_prof_end
  ON schedule_blocks (clinic_id, professional_id, end_at);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_clinic_start
  ON schedule_blocks (clinic_id, start_at);

CREATE INDEX IF NOT EXISTS idx_telemedicine_sessions_clinic_created
  ON telemedicine_sessions (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_records_clinic_patient_created
  ON consent_records (clinic_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_clinic_status_created
  ON reminder_logs (clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_invitations_clinic_created
  ON clinic_invitations (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_orders_clinic_draft_created
  ON medical_orders (clinic_id, created_at DESC)
  WHERE status = 'draft';

-- Caja module (034) may not exist on all environments.
DO $$
BEGIN
  IF to_regclass('public.patient_ledger_entries') IS NOT NULL THEN
    DROP INDEX IF EXISTS idx_patient_ledger_patient;
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_patient_ledger_clinic_patient_entry
        ON patient_ledger_entries (clinic_id, patient_id, entry_at DESC)
    $sql$;
  END IF;

  IF to_regclass('public.cash_charges') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_cash_charges_appointment
        ON cash_charges (appointment_id)
        WHERE appointment_id IS NOT NULL
    $sql$;
  END IF;

  IF to_regclass('public.cash_invoices') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_cash_invoices_clinic_patient
        ON cash_invoices (clinic_id, patient_id)
    $sql$;
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_cash_invoices_charge
        ON cash_invoices (cash_charge_id)
        WHERE cash_charge_id IS NOT NULL
    $sql$;
  END IF;

  IF to_regclass('public.clinical_record_attachments') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_clinical_record_attachments_record
        ON clinical_record_attachments (clinical_record_id)
    $sql$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Planner statistics refresh
-- ---------------------------------------------------------------------------

ANALYZE patients;
ANALYZE appointments;
ANALYZE clinical_records;
ANALYZE professionals;
ANALYZE reminder_logs;
ANALYZE telemedicine_sessions;
