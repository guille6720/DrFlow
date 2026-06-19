-- Registro de envío del link de instalación de app pacientes (una vez por paciente).

CREATE TABLE IF NOT EXISTS patient_app_share_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'copy')),
  CONSTRAINT patient_app_share_log_patient_unique UNIQUE (patient_id)
);

CREATE INDEX IF NOT EXISTS patient_app_share_log_clinic_idx
  ON patient_app_share_log(clinic_id);

ALTER TABLE patient_app_share_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_app_share_log_select ON patient_app_share_log
  FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY patient_app_share_log_insert ON patient_app_share_log
  FOR INSERT
  WITH CHECK (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));
