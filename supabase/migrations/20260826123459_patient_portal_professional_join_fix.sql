-- Reconcile remote Staging migration 20260826123459_patient_portal_professional_join_fix
-- ALREADY APPLIED on staging. Do not re-apply blindly.
-- Ensures get_patient_portal_appointments_v2 joins professionals/profiles correctly.

CREATE OR REPLACE FUNCTION public.get_patient_portal_appointments_v2(p_token text)
RETURNS TABLE(
  appointment_id uuid,
  status public.appointment_status,
  start_at timestamptz,
  end_at timestamptz,
  booking_source text,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by_type text,
  professional_name text,
  patient_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public._resolve_patient_portal_session(p_token, 'appointments:read');

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
    pg_catalog.btrim(pg_catalog.concat_ws(' ', pat.first_name, pat.last_name)) AS patient_name,
    a.created_at
  FROM public.appointments a
  JOIN public.patients pat ON pat.id = a.patient_id
  LEFT JOIN public.professionals pro ON pro.id = a.professional_id
  LEFT JOIN public.profiles pr ON pr.id = pro.user_id
  WHERE a.clinic_id = v_session.clinic_id
    AND a.patient_id = v_session.patient_id
    AND a.booking_source = 'online'
    AND (
      a.start_at >= pg_catalog.now() - interval '30 days'
      OR a.status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status)
    )
  ORDER BY a.start_at DESC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_appointment_statuses_v2(
  p_token text,
  p_appointment_ids uuid[]
)
RETURNS TABLE(
  appointment_id uuid,
  status public.appointment_status,
  start_at timestamptz,
  booking_source text,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
BEGIN
  IF p_appointment_ids IS NULL OR pg_catalog.cardinality(p_appointment_ids) = 0 THEN
    RETURN;
  END IF;

  SELECT * INTO v_session
  FROM public._resolve_patient_portal_session(p_token, 'appointments:read');

  RETURN QUERY
  SELECT a.id, a.status, a.start_at, a.booking_source,
         a.cancellation_reason, a.cancelled_at, a.cancelled_by_type
  FROM public.appointments a
  WHERE a.id = ANY(p_appointment_ids)
    AND a.clinic_id = v_session.clinic_id
    AND a.patient_id = v_session.patient_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_patient_appointment_v2(
  p_token text,
  p_appointment_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
  v_reason text := pg_catalog.btrim(p_reason);
BEGIN
  IF v_reason IS NULL OR pg_catalog.length(v_reason) < 3 OR pg_catalog.length(v_reason) > 500 THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  SELECT * INTO v_session
  FROM public._resolve_patient_portal_session(p_token, 'appointments:cancel');

  UPDATE public.appointments a
  SET status = 'cancelled'::public.appointment_status,
      cancellation_reason = v_reason,
      cancelled_at = pg_catalog.now(),
      cancelled_by_type = 'patient',
      cancelled_by = NULL,
      updated_at = pg_catalog.now()
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_session.clinic_id
    AND a.patient_id = v_session.patient_id
    AND a.status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  PERFORM public.enqueue_appointment_notification_events(p_appointment_id, 'cancellation');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_patient_data_consent_v2(
  p_token text,
  p_consent_type text,
  p_document_version text,
  p_granted boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
  v_type text := pg_catalog.btrim(p_consent_type);
  v_version text := NULLIF(pg_catalog.btrim(p_document_version), '');
BEGIN
  IF v_type IS NULL OR pg_catalog.length(v_type) = 0 OR pg_catalog.length(v_type) > 100 THEN
    RAISE EXCEPTION 'INVALID_CONSENT_TYPE';
  END IF;
  IF v_version IS NOT NULL AND pg_catalog.length(v_version) > 100 THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_VERSION';
  END IF;

  SELECT * INTO v_session
  FROM public._resolve_patient_portal_session(p_token, 'consent:write');

  INSERT INTO public.consent_records (
    clinic_id, patient_id, consent_type, granted, granted_at,
    document_version, purpose, source
  ) VALUES (
    v_session.clinic_id,
    v_session.patient_id,
    v_type,
    COALESCE(p_granted, false),
    CASE WHEN COALESCE(p_granted, false) THEN pg_catalog.now() ELSE NULL END,
    v_version,
    'patient_data_processing_patient_portal',
    'patient_portal_token'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_portal_appointments_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_portal_appointments_v2(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_patient_appointment_statuses_v2(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_appointment_statuses_v2(text, uuid[]) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancel_patient_appointment_v2(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_patient_appointment_v2(text, uuid, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_patient_data_consent_v2(text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_patient_data_consent_v2(text, text, text, boolean) TO anon, authenticated, service_role;
