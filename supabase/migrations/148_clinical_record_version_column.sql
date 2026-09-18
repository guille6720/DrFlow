-- Staging/partial DBs may have update_clinical_record_atomic (130/147 body)
-- without clinical_records.record_version → "record v_old has no field record_version".

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS record_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN clinical_records.record_version IS
  'Monotonic version per consulta; incremented on each audited update via update_clinical_record_atomic.';

ALTER TABLE clinical_record_audit
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

COMMENT ON COLUMN clinical_record_audit.change_reason IS
  'Optional clinician-provided reason for correction (Ley 26.529 traceability).';
