-- Phase 9: composite indexes for hot patient workspace and timeline queries

CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_patient_created
  ON clinical_records (clinic_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_attachments_clinic_patient_created
  ON patient_attachments (clinic_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescription_drafts_clinic_patient_status_issued
  ON prescription_drafts (clinic_id, patient_id, status, issued_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_medical_orders_clinic_patient_issued
  ON medical_orders (clinic_id, patient_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient_status_start
  ON appointments (clinic_id, patient_id, status, start_at DESC);
