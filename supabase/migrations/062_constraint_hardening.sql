-- Phase 19: constraint hardening — NOT NULL, UNIQUE, CHECK, DEFAULT alignment.
-- Idempotent. Repair legacy NULLs before strict constraints; no business-row DELETE.
-- See CONSTRAINT_AUDIT_REPORT.md

-- ---------------------------------------------------------------------------
-- 0. Data repair (safe backfills — preserves rows)
-- ---------------------------------------------------------------------------

UPDATE professionals p
SET display_name = COALESCE(
  NULLIF(trim(p.display_name), ''),
  pr.full_name,
  NULLIF(trim(p.license_number), ''),
  'Profesional'
)
FROM profiles pr
WHERE p.user_id = pr.id
  AND (p.display_name IS NULL OR trim(p.display_name) = '');

UPDATE professionals
SET display_name = COALESCE(
  NULLIF(trim(display_name), ''),
  NULLIF(trim(license_number), ''),
  'Profesional'
)
WHERE display_name IS NULL OR trim(display_name) = '';

UPDATE appointments
SET cancelled_at = COALESCE(cancelled_at, updated_at, created_at)
WHERE status = 'cancelled'
  AND cancelled_at IS NULL;

UPDATE consent_records
SET granted_at = COALESCE(granted_at, created_at)
WHERE granted = true
  AND granted_at IS NULL;

UPDATE prescription_drafts
SET issued_at = COALESCE(issued_at, updated_at, created_at)
WHERE status = 'issued'
  AND issued_at IS NULL;

UPDATE prescription_drafts
SET diagnosis_cie10 = COALESCE(NULLIF(trim(diagnosis_cie10), ''), 'Z00.0'),
    diagnosis_text = COALESCE(NULLIF(trim(diagnosis_text), ''), 'Sin especificar')
WHERE status IN ('issued', 'void')
  AND (
    diagnosis_cie10 IS NULL OR trim(diagnosis_cie10) = ''
    OR diagnosis_text IS NULL OR trim(diagnosis_text) = ''
  );

UPDATE payments
SET deposit_amount = 0
WHERE deposit_amount IS NULL OR deposit_amount < 0;

UPDATE payments
SET deposit_amount = amount
WHERE deposit_amount > amount;

UPDATE appointments
SET cancelled_by_type = NULL
WHERE cancelled_by_type IS NOT NULL
  AND status <> 'cancelled';

-- Dedup catalog names before UNIQUE (suffix id fragment, no DELETE).
WITH dups AS (
  SELECT id,
    row_number() OVER (PARTITION BY clinic_id, lower(trim(name)) ORDER BY created_at, id) AS rn
  FROM specialties
)
UPDATE specialties s
SET name = trim(s.name) || ' (' || substr(s.id::text, 1, 8) || ')'
FROM dups d
WHERE s.id = d.id AND d.rn > 1;

WITH dups AS (
  SELECT id,
    row_number() OVER (PARTITION BY clinic_id, lower(trim(name)) ORDER BY created_at, id) AS rn
  FROM consultation_reasons
)
UPDATE consultation_reasons c
SET name = trim(c.name) || ' (' || substr(c.id::text, 1, 8) || ')'
FROM dups d
WHERE c.id = d.id AND d.rn > 1;

-- ---------------------------------------------------------------------------
-- 1. DEFAULT alignment
-- ---------------------------------------------------------------------------

ALTER TABLE payments
  ALTER COLUMN deposit_amount SET DEFAULT 0;

ALTER TABLE consent_records
  ALTER COLUMN granted SET DEFAULT false;

DO $$
BEGIN
  IF to_regclass('public.patient_attachments') IS NOT NULL THEN
    ALTER TABLE patient_attachments
      ALTER COLUMN category SET DEFAULT 'otro';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. NOT NULL (only after backfill above)
-- ---------------------------------------------------------------------------

ALTER TABLE professionals
  ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE payments
  ALTER COLUMN deposit_amount SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. UNIQUE natural keys
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_specialties_clinic_name
  ON specialties (clinic_id, lower(trim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_reasons_clinic_name
  ON consultation_reasons (clinic_id, lower(trim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_prescription_drafts_number
  ON prescription_drafts (prescription_number)
  WHERE prescription_number IS NOT NULL AND prescription_number <> '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM telemedicine_sessions
    GROUP BY appointment_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_telemedicine_sessions_appointment
      ON telemedicine_sessions (appointment_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. CHECK constraints (conditional / state-aware)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE prescription_drafts
    ADD CONSTRAINT prescription_drafts_validity_days_check
    CHECK (validity_days BETWEEN 1 AND 365);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE prescription_drafts
    ADD CONSTRAINT prescription_drafts_issued_complete_check
    CHECK (
      status NOT IN ('issued', 'void')
      OR (
        diagnosis_cie10 IS NOT NULL AND trim(diagnosis_cie10) <> ''
        AND diagnosis_text IS NOT NULL AND trim(diagnosis_text) <> ''
        AND issued_at IS NOT NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE appointments
    ADD CONSTRAINT appointments_cancelled_timestamp_check
    CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE appointments
    ADD CONSTRAINT appointments_cancelled_by_type_state_check
    CHECK (cancelled_by_type IS NULL OR status = 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE consent_records
    ADD CONSTRAINT consent_records_granted_timestamp_check
    CHECK (granted = false OR granted_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE telemedicine_sessions
    ADD CONSTRAINT telemedicine_sessions_time_order_check
    CHECK (
      ended_at IS NULL
      OR started_at IS NULL
      OR ended_at >= started_at
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments
    ADD CONSTRAINT payments_deposit_bounds_check
    CHECK (deposit_amount >= 0 AND deposit_amount <= amount);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments
    ADD CONSTRAINT payments_paid_amount_check
    CHECK (status <> 'paid' OR amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clinic_jobs
    ADD CONSTRAINT clinic_jobs_job_type_check
    CHECK (job_type IN (
      'send_reminder',
      'send_email',
      'generate_report',
      'import_hce_batch',
      'import_patients_batch',
      'import_clinical_pdf',
      'run_ai_task'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE patient_attachments
    ADD CONSTRAINT patient_attachments_file_size_check
    CHECK (file_size IS NULL OR file_size >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill reminder sent_at before sent-status CHECK.
UPDATE reminder_logs
SET sent_at = COALESCE(sent_at, created_at)
WHERE status IN ('sent', 'simulated')
  AND sent_at IS NULL;

DO $$ BEGIN
  ALTER TABLE reminder_logs
    ADD CONSTRAINT reminder_logs_sent_timestamp_check
    CHECK (status NOT IN ('sent', 'simulated') OR sent_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cash_charges') IS NOT NULL THEN
    UPDATE cash_charges
    SET amount = 0
    WHERE amount IS NULL OR amount < 0;

    BEGIN
      ALTER TABLE cash_charges
        ADD CONSTRAINT cash_charges_collected_amount_check
        CHECK (status <> 'collected' OR amount > 0);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Verification helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_constraint_integrity()
RETURNS TABLE (check_name TEXT, violation_count BIGINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 'appointments_cancelled_without_timestamp'::TEXT, count(*)
  FROM appointments WHERE status = 'cancelled' AND cancelled_at IS NULL
  UNION ALL
  SELECT 'consent_granted_without_timestamp', count(*)
  FROM consent_records WHERE granted = true AND granted_at IS NULL
  UNION ALL
  SELECT 'prescription_issued_incomplete', count(*)
  FROM prescription_drafts
  WHERE status IN ('issued', 'void')
    AND (
      diagnosis_cie10 IS NULL OR trim(diagnosis_cie10) = ''
      OR diagnosis_text IS NULL OR trim(diagnosis_text) = ''
      OR issued_at IS NULL
    )
  UNION ALL
  SELECT 'payments_deposit_out_of_bounds', count(*)
  FROM payments
  WHERE deposit_amount < 0 OR deposit_amount > amount
  UNION ALL
  SELECT 'professionals_missing_display_name', count(*)
  FROM professionals
  WHERE display_name IS NULL OR trim(display_name) = '';
$$;

COMMENT ON FUNCTION verify_constraint_integrity IS
  'Post-062 sanity check: all violation_count should be 0.';
