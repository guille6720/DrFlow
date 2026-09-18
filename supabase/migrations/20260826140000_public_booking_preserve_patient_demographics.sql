-- Reconcile remote Staging migration 20260826140000_public_booking_preserve_patient_demographics
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- Phase 6: public booking must not overwrite demographics of an existing patient.
-- New patients are still inserted; existing records keep staff-managed contact data.

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
    PERFORM raise_app_error('INVALID_BOOKING_SLUG', 'Link de reserva invÃ¡lido o inactivo');
  END IF;

  SELECT clinic_id INTO v_prof_clinic
  FROM professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> v_clinic_id THEN
    PERFORM raise_app_error(
      'INVALID_PROFESSIONAL_FOR_CLINIC',
      'Profesional no vÃ¡lido para esta clÃ­nica'
    );
  END IF;

  IF p_start_at < now() THEN
    PERFORM raise_app_error('BOOKING_SLOT_IN_PAST', 'El horario seleccionado ya pasÃ³');
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
    PERFORM raise_app_error('BOOKING_SLOT_UNAVAILABLE', 'El horario ya no estÃ¡ disponible');
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
  END IF;
  -- Existing patient: do NOT overwrite first_name, last_name, phone, or email.

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

  PERFORM public.enqueue_appointment_notification_events(v_appointment_id, 'booking');

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'patient_id', v_patient_id,
    'clinic_id', v_clinic_id,
    'status', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_booking(
  text, uuid, timestamptz, text, text, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(
  text, uuid, timestamptz, text, text, text, text, text, text, text, text
) TO anon, authenticated, service_role;
