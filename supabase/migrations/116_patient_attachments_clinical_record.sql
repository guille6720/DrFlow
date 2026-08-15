-- Link clinical attachments to a consultation when available (consultas UX).
-- Keeps patient_id + clinic_id isolation; path uses consultations/{id}/ when set.

ALTER TABLE patient_attachments
  ADD COLUMN IF NOT EXISTS clinical_record_id UUID
    REFERENCES clinical_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_attachments_clinic_record
  ON patient_attachments (clinic_id, clinical_record_id)
  WHERE clinical_record_id IS NOT NULL;

COMMENT ON COLUMN patient_attachments.clinical_record_id IS
  'Optional consultation (clinical_records) that owns this attachment.';
