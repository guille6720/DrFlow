-- Reconcile remote Staging migration 20260826120735_public_portal_identity_hardening
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- DrFlow Phase 5: protect patient portal functions that relied on slug + DNI only.
-- Staging only. These operations must require an authenticated/signed patient session
-- or a cryptographically strong scoped portal token before anonymous access is restored.

REVOKE EXECUTE ON FUNCTION public.cancel_patient_appointment(text,text,uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text,text,uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_portal_appointments(text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_patient_data_consent(text,text,text,text,boolean) FROM PUBLIC, anon;

-- Keep signed-in/server compatibility while public patient identity is redesigned.
GRANT EXECUTE ON FUNCTION public.cancel_patient_appointment(text,text,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text,text,uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_portal_appointments(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_patient_data_consent(text,text,text,text,boolean) TO authenticated, service_role;

-- Public booking must not overwrite an existing patient's demographics/contact details
-- based solely on knowledge of a document number.
CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_slug text,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_document_number text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_consent_type text DEFAULT NULL,
  p_consent_document_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id UUID;
  v_link_id UUID;
  v_patient_id UUID;
  v_appointment_id UUID;
  v_duration INTEGER;
  v_end_at TIMESTAMPTZ;
  v_prof_clinic UUID;
  v_document_number TEXT := trim(p_document_number);
BEGIN
  IF v_document_number IS NULL OR length(v_document_number) < 6 THEN
    PERFORM public.raise_app_error('INVALID_DOCUMENT_NUMBER', 'Documento invÃ¡lido');
  END IF;
  IF trim(coalesce(p_first_name, '')) = '' OR trim(coalesce(p_last_name, '')) = '' THEN
    PERFORM public.raise_app_error('PATIENT_NAME_REQUIRED', 'Nombre y apellido son obligatorios');
  END IF;

  SELECT bl.clinic_id, bl.id INTO v_clinic_id, v_link_id
  FROM public.public_booking_links bl
  WHERE bl.slug = p_slug AND bl.is_active = true;

  IF v_clinic_id IS NULL THEN
    PERFORM public.raise_app_error('INVALID_BOOKING_SLUG', 'Link de reserva invÃ¡lido o inactivo');
  END IF;

  SELECT clinic_id INTO v_prof_clinic
  FROM public.professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> v_clinic_id THEN
    PERFORM public.raise_app_error('INVALID_PROFESSIONAL_FOR_CLINIC', 'Profesional no vÃ¡lido para esta clÃ­nica');
  END IF;

  IF p_start_at < now() THEN
    PERFORM public.raise_app_error('BOOKING_SLOT_IN_PAST', 'El horario seleccionado ya pasÃ³');
  END IF;

  SELECT default_appointment_duration INTO v_duration
  FROM public.clinics WHERE id = v_clinic_id;
  v_end_at := p_start_at + (COALESCE(v_duration, 30) || ' minutes')::interval;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled'::public.appointment_status)
      AND a.start_at < v_end_at
      AND a.end_at > p_start_at
  ) THEN
    PERFORM public.raise_app_error('BOOKING_SLOT_UNAVAILABLE', 'El horario ya no estÃ¡ disponible');
  END IF;

  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE clinic_id = v_clinic_id AND document_number = v_document_number;

  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (
      v_clinic_id,
      trim(p_first_name),
      trim(p_last_name),
      v_document_number,
      trim(p_phone),
      NULLIF(trim(p_email), '')
    )
    RETURNING id INTO v_patient_id;
  END IF;

  INSERT INTO public.appointments (
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
    'pending'::public.appointment_status,
    COALESCE(p_reason, 'Solicitud online'),
    'online'
  FROM public.professionals pro
  WHERE pro.id = p_professional_id
  RETURNING id INTO v_appointment_id;

  IF p_consent_type IS NOT NULL AND trim(p_consent_type) <> '' THEN
    INSERT INTO public.consent_records (
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

  -- Do not expose patient_id or clinic_id to anonymous callers.
  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'status', 'pending'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_public_booking(text,uuid,timestamptz,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(text,uuid,timestamptz,text,text,text,text,text,text,text,text) TO anon, authenticated, service_role;;
