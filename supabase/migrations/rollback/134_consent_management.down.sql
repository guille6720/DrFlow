-- ROLLBACK 134_consent_management (PARTIAL — staging/local only).
-- Drops withdrawal columns/indexes/triggers added in 134.
-- Existing consent rows remain. patient_id NOT NULL is NOT restored automatically
-- (may fail if clinic-level NULL rows exist).
-- DO NOT run on production without an explicit ops runbook.

DROP TRIGGER IF EXISTS consent_records_immutability ON consent_records;
DROP FUNCTION IF EXISTS public.enforce_consent_record_immutability();

DROP INDEX IF EXISTS idx_consent_records_clinic_type_created;
DROP INDEX IF EXISTS idx_consent_records_withdrawn;
DROP INDEX IF EXISTS idx_consent_records_informed_per_record;

ALTER TABLE consent_records
  DROP COLUMN IF EXISTS purpose,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS withdrawn_at,
  DROP COLUMN IF EXISTS withdrawn_by,
  DROP COLUMN IF EXISTS withdrawal_reason;

-- Recreate pre-134 unique informed index if it existed without withdrawn filter:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_records_informed_per_record
--   ON consent_records (clinical_record_id)
--   WHERE consent_type = 'informed_consent_clinical_act' AND granted = true;
