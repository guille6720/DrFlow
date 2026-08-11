-- Fase 3D: retención de datos clínicos y trazabilidad de baja de pacientes

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS clinical_record_retention_years INT NOT NULL DEFAULT 10;

ALTER TABLE clinics
  DROP CONSTRAINT IF EXISTS clinics_clinical_record_retention_years_check;

ALTER TABLE clinics
  ADD CONSTRAINT clinics_clinical_record_retention_years_check
  CHECK (clinical_record_retention_years >= 5 AND clinical_record_retention_years <= 30);

COMMENT ON COLUMN clinics.clinical_record_retention_years IS
  'Años mínimos de conservación de historias clínicas (Ley 26.529 / práctica habitual).';

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN patients.deactivated_at IS 'Baja lógica del paciente — datos clínicos se conservan según política de retención.';
COMMENT ON COLUMN patients.deactivated_by IS 'Usuario que registró la baja lógica del paciente.';

CREATE INDEX IF NOT EXISTS idx_patients_clinic_deactivated
  ON patients (clinic_id, deactivated_at DESC)
  WHERE deactivated_at IS NOT NULL;

-- Backfill deactivated_at for patients already marked inactive
UPDATE patients
SET deactivated_at = COALESCE(deactivated_at, updated_at, created_at)
WHERE is_active = false AND deactivated_at IS NULL;
