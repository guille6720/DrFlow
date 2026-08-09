-- Portal "Mis turnos" server-side + automatic appointment notification queue.

-- ---------------------------------------------------------------------------
-- Resolve clinic from portal/booking slug
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_portal_clinic_id(p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
BEGIN
  SELECT c.id INTO v_clinic_id
  FROM clinics c
  WHERE c.slug = p_slug AND c.is_active = true;

  IF v_clinic_id IS NULL THEN
    SELECT bl.clinic_id INTO v_clinic_id
    FROM public_booking_links bl
    WHERE bl.slug = p_slug AND bl.is_active = true;
  END IF;

  RETURN v_clinic_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- List patient appointments by DNI (portal / public booking)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_patient_portal_appointments(
  p_slug TEXT,
  p_document_number TEXT
)
RETURNS TABLE (
  appointment_id UUID,
  status appointment_status,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  booking_source TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_type TEXT,
  professional_name TEXT,
  patient_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_dni TEXT := trim(p_document_number);
BEGIN
  IF v_dni IS NULL OR length(v_dni) < 6 THEN
    RETURN;
  END IF;

  v_clinic_id := public.resolve_portal_clinic_id(p_slug);
  IF v_clinic_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.status,
    a.start_at,
    a.end_at,
    a.booking_source,
    a.cancellation_reason,
    a.cancelled_at,
    a.cancelled_by_type,
    COALESCE(pro.display_name, pr.full_name, 'Profesional') AS professional_name,
    trim(concat_ws(' ', pat.first_name, pat.last_name)) AS patient_name,
    a.created_at
  FROM appointments a
  JOIN patients pat ON pat.id = a.patient_id
  LEFT JOIN professionals pro ON pro.id = a.professional_id
  LEFT JOIN profiles pr ON pr.id = pro.profile_id
  WHERE a.clinic_id = v_clinic_id
    AND pat.document_number = v_dni
    AND a.booking_source = 'online'
    AND (
      a.start_at >= now() - interval '30 days'
      OR a.status IN ('pending'::appointment_status, 'confirmed'::appointment_status)
    )
  ORDER BY a.start_at DESC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_portal_appointments(TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cancel pending reminder rows when appointment is cancelled/rescheduled
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_pending_appointment_reminders(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM appointment_notification_queue
  WHERE appointment_id = p_appointment_id
    AND status = 'queued'::reminder_status
    AND event_type IN ('reminder_48h', 'reminder_24h');
END;
$$;

-- ---------------------------------------------------------------------------
-- Enqueue lifecycle notifications (idempotent per appointment/event/channel)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_appointment_notification_events(
  p_appointment_id UUID,
  p_trigger TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_clinic_name TEXT;
  v_professional_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT
    a.id,
    a.clinic_id,
    a.patient_id,
    a.professional_id,
    a.start_at,
    a.end_at,
    a.status,
    pat.first_name,
    pat.last_name,
    pat.email,
    pat.phone,
    COALESCE(pro.display_name, pr.full_name, 'Profesional') AS professional_name
  INTO v_row
  FROM appointments a
  JOIN patients pat ON pat.id = a.patient_id
  LEFT JOIN professionals pro ON pro.id = a.professional_id
  LEFT JOIN profiles pr ON pr.id = pro.profile_id
  WHERE a.id = p_appointment_id;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  SELECT name INTO v_clinic_name FROM clinics WHERE id = v_row.clinic_id;

  v_payload := jsonb_build_object(
    'patient_id', v_row.patient_id,
    'patient_name', trim(concat_ws(' ', v_row.first_name, v_row.last_name)),
    'professional_name', v_row.professional_name,
    'clinic_name', COALESCE(v_clinic_name, 'Consultorio'),
    'start_at', v_row.start_at,
    'end_at', v_row.end_at,
    'status', v_row.status
  );

  IF p_trigger IN ('booking', 'confirmation') THEN
    IF v_row.email IS NOT NULL AND trim(v_row.email) <> '' THEN
      INSERT INTO appointment_notification_queue (
        clinic_id, appointment_id, event_type, channel, recipient, payload, scheduled_for
      )
      SELECT
        v_row.clinic_id,
        p_appointment_id,
        'confirmation',
        'email'::reminder_channel,
        trim(v_row.email),
        v_payload,
        now()
      WHERE NOT EXISTS (
        SELECT 1 FROM appointment_notification_queue q
        WHERE q.appointment_id = p_appointment_id
          AND q.event_type = 'confirmation'
          AND q.channel = 'email'::reminder_channel
          AND q.status = 'queued'::reminder_status
      );
    ELSIF v_row.phone IS NOT NULL AND trim(v_row.phone) <> '' THEN
      INSERT INTO appointment_notification_queue (
        clinic_id, appointment_id, event_type, channel, recipient, payload, scheduled_for
      )
      SELECT
        v_row.clinic_id,
        p_appointment_id,
        'confirmation',
        'whatsapp'::reminder_channel,
        trim(v_row.phone),
        v_payload,
        now()
      WHERE NOT EXISTS (
        SELECT 1 FROM appointment_notification_queue q
        WHERE q.appointment_id = p_appointment_id
          AND q.event_type = 'confirmation'
          AND q.channel = 'whatsapp'::reminder_channel
          AND q.status = 'queued'::reminder_status
      );
    END IF;

    IF v_row.start_at - interval '48 hours' > now() THEN
      INSERT INTO appointment_notification_queue (
        clinic_id, appointment_id, event_type, channel, recipient, payload, scheduled_for
      )
      SELECT
        v_row.clinic_id,
        p_appointment_id,
        'reminder_48h',
        CASE
          WHEN v_row.email IS NOT NULL AND trim(v_row.email) <> '' THEN 'email'::reminder_channel
          WHEN v_row.phone IS NOT NULL AND trim(v_row.phone) <> '' THEN 'whatsapp'::reminder_channel
          ELSE 'internal'::reminder_channel
        END,
        COALESCE(NULLIF(trim(v_row.email), ''), NULLIF(trim(v_row.phone), ''), 'patient'),
        v_payload,
        v_row.start_at - interval '48 hours'
      WHERE NOT EXISTS (
        SELECT 1 FROM appointment_notification_queue q
        WHERE q.appointment_id = p_appointment_id
          AND q.event_type = 'reminder_48h'
          AND q.status = 'queued'::reminder_status
      );
    END IF;

    IF v_row.start_at - interval '24 hours' > now() THEN
      INSERT INTO appointment_notification_queue (
        clinic_id, appointment_id, event_type, channel, recipient, payload, scheduled_for
      )
      SELECT
        v_row.clinic_id,
        p_appointment_id,
        'reminder_24h',
        CASE
          WHEN v_row.email IS NOT NULL AND trim(v_row.email) <> '' THEN 'email'::reminder_channel
          WHEN v_row.phone IS NOT NULL AND trim(v_row.phone) <> '' THEN 'whatsapp'::reminder_channel
          ELSE 'internal'::reminder_channel
        END,
        COALESCE(NULLIF(trim(v_row.email), ''), NULLIF(trim(v_row.phone), ''), 'patient'),
        v_payload,
        v_row.start_at - interval '24 hours'
      WHERE NOT EXISTS (
        SELECT 1 FROM appointment_notification_queue q
        WHERE q.appointment_id = p_appointment_id
          AND q.event_type = 'reminder_24h'
          AND q.status = 'queued'::reminder_status
      );
    END IF;
  END IF;

  IF p_trigger = 'cancellation' THEN
    PERFORM public.cancel_pending_appointment_reminders(p_appointment_id);

    INSERT INTO appointment_notification_queue (
      clinic_id, appointment_id, event_type, channel, recipient, payload, scheduled_for
    )
    SELECT
      v_row.clinic_id,
      p_appointment_id,
      'cancellation',
      'internal'::reminder_channel,
      COALESCE(NULLIF(trim(v_row.phone), ''), NULLIF(trim(v_row.email), ''), 'patient'),
      v_payload || jsonb_build_object('trigger', p_trigger),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM appointment_notification_queue q
      WHERE q.appointment_id = p_appointment_id
        AND q.event_type = 'cancellation'
        AND q.status = 'queued'::reminder_status
        AND q.created_at > now() - interval '5 minutes'
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Worker: claim pending notifications due for delivery
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_appointment_notifications(p_limit INT DEFAULT 10)
RETURNS SETOF appointment_notification_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM appointment_notification_queue
    WHERE status = 'queued'::reminder_status
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE appointment_notification_queue q
  SET scheduled_for = now() + interval '30 minutes'
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_appointment_notification(
  p_id UUID,
  p_status reminder_status,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('sent'::reminder_status, 'failed'::reminder_status, 'simulated'::reminder_status) THEN
    RAISE EXCEPTION 'Invalid notification status: %', p_status;
  END IF;

  UPDATE appointment_notification_queue
  SET
    status = p_status,
    sent_at = CASE WHEN p_status IN ('sent'::reminder_status, 'simulated'::reminder_status) THEN now() ELSE sent_at END,
    error_message = NULLIF(trim(p_error_message), ''),
    scheduled_for = CASE
      WHEN p_status = 'failed'::reminder_status THEN now() + interval '5 minutes'
      ELSE scheduled_for
    END
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_appointment_notifications(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_appointment_notification(UUID, reminder_status, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_pending_appointment_reminders(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_appointment_notification_events(UUID, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Hook booking + patient cancellation into notification queue
-- ---------------------------------------------------------------------------
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

  PERFORM public.enqueue_appointment_notification_events(v_appointment_id, 'booking');

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'patient_id', v_patient_id,
    'clinic_id', v_clinic_id,
    'status', 'pending'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_patient_appointment(
  p_slug TEXT,
  p_document_number TEXT,
  p_appointment_id UUID,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_reason TEXT := trim(p_reason);
BEGIN
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  v_clinic_id := public.resolve_portal_clinic_id(p_slug);

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  UPDATE appointments a
  SET
    status = 'cancelled'::appointment_status,
    cancellation_reason = v_reason,
    cancelled_at = now(),
    cancelled_by_type = 'patient',
    cancelled_by = NULL,
    updated_at = now()
  FROM patients p
  WHERE a.id = p_appointment_id
    AND a.patient_id = p.id
    AND a.clinic_id = v_clinic_id
    AND p.document_number = trim(p_document_number)
    AND a.status IN ('pending'::appointment_status, 'confirmed'::appointment_status);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  PERFORM public.enqueue_appointment_notification_events(p_appointment_id, 'cancellation');
END;
$$;
