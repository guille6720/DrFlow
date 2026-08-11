-- Production fix: Fase 3C consentimiento informado digital (migration 098).
-- Safe to re-run.

ALTER TABLE consent_records
  ADD COLUMN IF NOT EXISTS clinical_record_id UUID REFERENCES clinical_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS procedure_description TEXT,
  ADD COLUMN IF NOT EXISTS signature_name TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_consent_records_clinical_record
  ON consent_records (clinical_record_id, created_at DESC)
  WHERE clinical_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_records_informed_per_record
  ON consent_records (clinical_record_id)
  WHERE consent_type = 'informed_consent_clinical_act' AND granted = true AND clinical_record_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_informed_consent(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_clinical_record_id UUID,
  p_procedure_description TEXT,
  p_signature_name TEXT,
  p_document_version TEXT,
  p_appointment_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_consent_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF NOT can_view_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF trim(coalesce(p_procedure_description, '')) = '' THEN
    RAISE EXCEPTION 'PROCEDURE_REQUIRED';
  END IF;

  IF trim(coalesce(p_signature_name, '')) = '' THEN
    RAISE EXCEPTION 'SIGNATURE_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM patients
    WHERE id = p_patient_id AND clinic_id = p_clinic_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM clinical_records cr
    WHERE cr.id = p_clinical_record_id
      AND cr.clinic_id = p_clinic_id
      AND cr.patient_id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'CLINICAL_RECORD_NOT_FOUND';
  END IF;

  IF p_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE id = p_appointment_id AND clinic_id = p_clinic_id AND patient_id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1 FROM consent_records
    WHERE clinical_record_id = p_clinical_record_id
      AND consent_type = 'informed_consent_clinical_act'
      AND granted = true
  ) THEN
    RAISE EXCEPTION 'INFORMED_CONSENT_ALREADY_RECORDED';
  END IF;

  INSERT INTO consent_records (
    clinic_id,
    patient_id,
    clinical_record_id,
    appointment_id,
    recorded_by,
    consent_type,
    granted,
    granted_at,
    document_version,
    procedure_description,
    signature_name,
    notes,
    ip_address
  )
  VALUES (
    p_clinic_id,
    p_patient_id,
    p_clinical_record_id,
    p_appointment_id,
    v_user_id,
    'informed_consent_clinical_act',
    true,
    now(),
    p_document_version,
    trim(p_procedure_description),
    trim(p_signature_name),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_ip_address
  )
  RETURNING id INTO v_consent_id;

  RETURN v_consent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_informed_consent(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT, INET
) TO authenticated;
