-- Verify Phase 12 audit migration
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
  AND column_name IN ('patient_id', 'old_values', 'new_values');

SELECT tgname
FROM pg_trigger
WHERE tgname IN ('audit_logs_immutable', 'clinical_record_audit_immutable');
