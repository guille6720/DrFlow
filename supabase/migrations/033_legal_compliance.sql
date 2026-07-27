-- Cumplimiento legal: aceptación consultorio + consentimiento paciente (turno web)

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS legal_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS legal_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_privacy_version TEXT;

COMMENT ON COLUMN clinics.legal_terms_version IS 'Versión de /terminos aceptada por el titular de la cuenta';
COMMENT ON COLUMN clinics.legal_privacy_version IS 'Versión de /privacidad aceptada al alta';

CREATE OR REPLACE FUNCTION public.record_patient_data_consent(
  p_slug TEXT,
  p_document_number TEXT,
  p_consent_type TEXT,
  p_document_version TEXT,
  p_granted BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_patient_id UUID;
BEGIN
  SELECT bl.clinic_id INTO v_clinic_id
  FROM public_booking_links bl
  WHERE bl.slug = p_slug AND bl.is_active = true;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_BOOKING_SLUG';
  END IF;

  SELECT id INTO v_patient_id
  FROM patients
  WHERE clinic_id = v_clinic_id
    AND document_number = trim(p_document_number)
    AND is_active = true;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  INSERT INTO consent_records (
    clinic_id,
    patient_id,
    consent_type,
    granted,
    granted_at,
    document_version
  )
  VALUES (
    v_clinic_id,
    v_patient_id,
    p_consent_type,
    p_granted,
    CASE WHEN p_granted THEN now() ELSE NULL END,
    p_document_version
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_patient_data_consent TO anon, authenticated;
