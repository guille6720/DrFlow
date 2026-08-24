-- ROLLBACK 132_audit_log_security (staging/local only).
-- Restores looser INSERT policy shape from pre-132; drops insert-integrity triggers.
-- DO NOT run on production without an explicit ops runbook.

DROP TRIGGER IF EXISTS audit_logs_insert_integrity ON audit_logs;
DROP TRIGGER IF EXISTS clinical_record_audit_insert_integrity ON clinical_record_audit;
DROP FUNCTION IF EXISTS public.enforce_audit_insert_integrity();

-- Pre-132 style INSERT (membership write; authorship not forced to auth.uid() here).
DROP POLICY IF EXISTS clinical_record_audit_insert ON clinical_record_audit;
CREATE POLICY clinical_record_audit_insert ON clinical_record_audit FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR can_write_clinical(clinic_id)
  );

-- REVOKE from 132 is left in place intentionally (safer default).
-- To re-grant UPDATE/DELETE (not recommended): GRANT UPDATE, DELETE ON ... TO authenticated;
