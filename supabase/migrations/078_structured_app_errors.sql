-- Structured application errors: machine-readable DETAIL + friendly MESSAGE.

CREATE OR REPLACE FUNCTION public.raise_app_error(p_code text, p_user_message text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = COALESCE(p_user_message, p_code),
    DETAIL = p_code;
END;
$$;

COMMENT ON FUNCTION public.raise_app_error(text, text) IS
  'Raises P0001 with DETAIL = machine code and MESSAGE = user-facing text.';

CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.professional_id = NEW.professional_id
      AND a.id IS DISTINCT FROM NEW.id
      AND a.status NOT IN ('cancelled')
      AND a.start_at < NEW.end_at
      AND a.end_at > NEW.start_at
  ) THEN
    PERFORM raise_app_error(
      'APPOINTMENT_SLOT_CONFLICT',
      'El profesional ya tiene un turno en ese horario'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_slug TEXT,
  p_professional_id UUID,
  p_start_at TIMESTAMPTZ,
  p_first_name TEXT,
  p_last_name TEXT,
  p_document_number TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_consent_type TEXT DEFAULT NULL,
  p_consent_document_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_link_id UUID;
  v_patient_id UUID;
  v_appointment_id UUID;
  v_duration INTEGER;
  v_end_at TIMESTAMPTZ;
  v_prof_clinic UUID;
BEGIN
  SELECT bl.clinic_id, bl.id INTO v_clinic_id, v_link_id
  FROM public_booking_links bl
  WHERE bl.slug = p_slug AND bl.is_active = true;

  IF v_clinic_id IS NULL THEN
    PERFORM raise_app_error('INVALID_BOOKING_SLUG', 'Link de reserva inválido o inactivo');
  END IF;

  SELECT clinic_id INTO v_prof_clinic
  FROM professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> v_clinic_id THEN
    PERFORM raise_app_error(
      'INVALID_PROFESSIONAL_FOR_CLINIC',
      'Profesional no válido para esta clínica'
    );
  END IF;

  IF p_start_at < now() THEN
    PERFORM raise_app_error('BOOKING_SLOT_IN_PAST', 'El horario seleccionado ya pasó');
  END IF;

  SELECT default_appointment_duration INTO v_duration FROM clinics WHERE id = v_clinic_id;
  v_end_at := p_start_at + (COALESCE(v_duration, 30) || ' minutes')::interval;

  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled'::appointment_status)
      AND a.start_at < v_end_at
      AND a.end_at > p_start_at
  ) THEN
    PERFORM raise_app_error('BOOKING_SLOT_UNAVAILABLE', 'El horario ya no está disponible');
  END IF;

  SELECT id INTO v_patient_id
  FROM patients
  WHERE clinic_id = v_clinic_id AND document_number = trim(p_document_number);

  IF v_patient_id IS NULL THEN
    INSERT INTO patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (
      v_clinic_id,
      trim(p_first_name),
      trim(p_last_name),
      trim(p_document_number),
      trim(p_phone),
      NULLIF(trim(p_email), '')
    )
    RETURNING id INTO v_patient_id;
  ELSE
    UPDATE patients SET
      first_name = trim(p_first_name),
      last_name = trim(p_last_name),
      phone = trim(p_phone),
      email = COALESCE(NULLIF(trim(p_email), ''), email),
      updated_at = now()
    WHERE id = v_patient_id;
  END IF;

  INSERT INTO appointments (
    clinic_id, patient_id, professional_id, location_id, specialty_id,
    start_at, end_at, status, notes, booking_source
  )
  SELECT
    v_clinic_id,
    v_patient_id,
    p_professional_id,
    pro.location_id,
    pro.specialty_id,
    p_start_at,
    v_end_at,
    'pending'::appointment_status,
    COALESCE(p_reason, 'Solicitud online'),
    'online'
  FROM professionals pro
  WHERE pro.id = p_professional_id
  RETURNING id INTO v_appointment_id;

  IF p_consent_type IS NOT NULL AND trim(p_consent_type) <> '' THEN
    INSERT INTO consent_records (
      clinic_id, patient_id, consent_type, granted, granted_at, document_version
    )
    VALUES (
      v_clinic_id,
      v_patient_id,
      trim(p_consent_type),
      true,
      now(),
      p_consent_document_version
    );
  END IF;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'patient_id', v_patient_id,
    'clinic_id', v_clinic_id,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_booking(
  TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;
