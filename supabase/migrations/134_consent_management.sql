-- Phase 11: consent management — purpose/source, withdrawal, immutability, clinic-level signup.

-- ---------------------------------------------------------------------------
-- Schema extensions (append-only history; withdrawal marks a grant without erase)
-- ---------------------------------------------------------------------------
ALTER TABLE consent_records
  ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE consent_records
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawn_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;

COMMENT ON COLUMN consent_records.patient_id IS
  'Paciente titular del consentimiento. NULL solo para aceptaciones a nivel consultorio (alta / términos).';
COMMENT ON COLUMN consent_records.purpose IS
  'Finalidad del tratamiento de datos o del acto (texto o clave estable).';
COMMENT ON COLUMN consent_records.source IS
  'Canal de captura: public_booking | clinical_ui | clinic_signup | rpc | system.';
COMMENT ON COLUMN consent_records.withdrawn_at IS
  'Retiro del consentimiento. No borra el registro original (historial append-only vía campos).';
COMMENT ON COLUMN consent_records.withdrawn_by IS
  'Usuario que registró el retiro (staff autenticado).';
COMMENT ON COLUMN consent_records.withdrawal_reason IS
  'Motivo opcional del retiro.';

CREATE INDEX IF NOT EXISTS idx_consent_records_clinic_type_created
  ON consent_records (clinic_id, consent_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_records_withdrawn
  ON consent_records (clinic_id, patient_id, withdrawn_at DESC)
  WHERE withdrawn_at IS NOT NULL;

-- Informed consent unique: only one *active* grant per clinical record
DROP INDEX IF EXISTS idx_consent_records_informed_per_record;
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_records_informed_per_record
  ON consent_records (clinical_record_id)
  WHERE consent_type = 'informed_consent_clinical_act'
    AND granted = true
    AND withdrawn_at IS NULL
    AND clinical_record_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Immutability: no DELETE; UPDATE only to apply withdrawal once
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_consent_record_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CONSENT_IMMUTABLE: los consentimientos no se eliminan';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Allow only first-time withdrawal (and related columns)
    IF OLD.withdrawn_at IS NULL
       AND NEW.withdrawn_at IS NOT NULL
       AND NEW.id = OLD.id
       AND NEW.clinic_id IS NOT DISTINCT FROM OLD.clinic_id
       AND NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
       AND NEW.consent_type IS NOT DISTINCT FROM OLD.consent_type
       AND NEW.granted IS NOT DISTINCT FROM OLD.granted
       AND NEW.granted_at IS NOT DISTINCT FROM OLD.granted_at
       AND NEW.document_version IS NOT DISTINCT FROM OLD.document_version
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND NEW.clinical_record_id IS NOT DISTINCT FROM OLD.clinical_record_id
       AND NEW.appointment_id IS NOT DISTINCT FROM OLD.appointment_id
       AND NEW.recorded_by IS NOT DISTINCT FROM OLD.recorded_by
       AND NEW.procedure_description IS NOT DISTINCT FROM OLD.procedure_description
       AND NEW.signature_name IS NOT DISTINCT FROM OLD.signature_name
       AND NEW.purpose IS NOT DISTINCT FROM OLD.purpose
       AND NEW.source IS NOT DISTINCT FROM OLD.source
       AND NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'CONSENT_IMMUTABLE: no se puede modificar un consentimiento registrado (salvo retiro)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consent_records_immutable ON consent_records;
CREATE TRIGGER consent_records_immutable
  BEFORE UPDATE OR DELETE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_consent_record_immutability();

REVOKE UPDATE, DELETE ON consent_records FROM PUBLIC;
REVOKE UPDATE, DELETE ON consent_records FROM anon;
REVOKE UPDATE, DELETE ON consent_records FROM authenticated;

-- ---------------------------------------------------------------------------
-- Withdrawal RPC (SECURITY DEFINER — only path that updates consent_records)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_patient_consent(
  p_consent_id UUID,
  p_clinic_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_row consent_records%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_row
  FROM consent_records
  WHERE id = p_consent_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONSENT_NOT_FOUND';
  END IF;

  IF v_row.granted IS NOT TRUE THEN
    RAISE EXCEPTION 'CONSENT_NOT_GRANTED';
  END IF;

  IF v_row.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'CONSENT_ALREADY_WITHDRAWN';
  END IF;

  UPDATE consent_records
  SET
    withdrawn_at = now(),
    withdrawn_by = v_user_id,
    withdrawal_reason = NULLIF(trim(COALESCE(p_reason, '')), '')
  WHERE id = p_consent_id AND clinic_id = p_clinic_id;

  RETURN p_consent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_patient_consent(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.withdraw_patient_consent IS
  'Registra retiro de consentimiento sin borrar el historial (Fase 11).';

-- ---------------------------------------------------------------------------
-- Enrich existing grant RPCs with purpose / source (non-destructive INSERT)
-- ---------------------------------------------------------------------------
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
    document_version,
    purpose,
    source
  )
  VALUES (
    v_clinic_id,
    v_patient_id,
    p_consent_type,
    p_granted,
    CASE WHEN p_granted THEN now() ELSE NULL END,
    p_document_version,
    'patient_data_processing_public_booking',
    'public_booking'
  );
END;
$$;

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
      AND withdrawn_at IS NULL
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
    ip_address,
    purpose,
    source
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
    p_ip_address,
    'informed_consent_clinical_act',
    'clinical_ui'
  )
  RETURNING id INTO v_consent_id;

  RETURN v_consent_id;
END;
$$;

-- Clinic signup / terms acceptance → consent_records (patient_id NULL)
CREATE OR REPLACE FUNCTION public.record_clinic_legal_consent(
  p_clinic_id UUID,
  p_consent_type TEXT,
  p_document_version TEXT,
  p_purpose TEXT DEFAULT 'clinic_legal_acceptance',
  p_source TEXT DEFAULT 'clinic_signup'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) = 'clinic_admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO consent_records (
    clinic_id,
    patient_id,
    consent_type,
    granted,
    granted_at,
    document_version,
    recorded_by,
    purpose,
    source
  )
  VALUES (
    p_clinic_id,
    NULL,
    p_consent_type,
    true,
    now(),
    p_document_version,
    v_user_id,
    p_purpose,
    p_source
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_clinic_legal_consent(UUID, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.record_clinic_legal_consent IS
  'Persiste aceptación de términos/privacidad del consultorio en consent_records (historial).';
