-- Production fix: Fase 3D retención y baja lógica (migration 099).
-- Safe to re-run.

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS clinical_record_retention_years INT NOT NULL DEFAULT 10;

ALTER TABLE clinics
  DROP CONSTRAINT IF EXISTS clinics_clinical_record_retention_years_check;

ALTER TABLE clinics
  ADD CONSTRAINT clinics_clinical_record_retention_years_check
  CHECK (clinical_record_retention_years >= 5 AND clinical_record_retention_years <= 30);

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_clinic_deactivated
  ON patients (clinic_id, deactivated_at DESC)
  WHERE deactivated_at IS NOT NULL;

UPDATE patients
SET deactivated_at = COALESCE(deactivated_at, updated_at, created_at)
WHERE is_active = false AND deactivated_at IS NULL;
