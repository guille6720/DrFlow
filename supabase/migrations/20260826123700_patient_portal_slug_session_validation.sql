-- Reconcile remote Staging migration 20260826123700_patient_portal_slug_session_validation
-- ALREADY APPLIED on staging. Do not re-apply blindly.
-- Token + clinic slug binding for magic-link entry.

CREATE OR REPLACE FUNCTION public.validate_patient_portal_session_v2(
  p_token text,
  p_slug text
)
RETURNS TABLE(valid boolean, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
  v_slug text := pg_catalog.btrim(p_slug);
  v_matches boolean := false;
BEGIN
  IF v_slug IS NULL OR pg_catalog.length(v_slug) = 0 OR pg_catalog.length(v_slug) > 160 THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;

  BEGIN
    SELECT * INTO v_session
    FROM public._resolve_patient_portal_session(p_token, 'appointments:read');
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END;

  SELECT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = v_session.clinic_id AND c.slug = v_slug
    UNION ALL
    SELECT 1 FROM public.public_booking_links pbl
    WHERE pbl.clinic_id = v_session.clinic_id
      AND pbl.slug = v_slug
      AND pbl.is_active = true
  ) INTO v_matches;

  IF NOT v_matches THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_session.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_patient_portal_session_v2(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_patient_portal_session_v2(text, text) TO anon, authenticated, service_role;

-- Legacy DNI portal RPCs must remain unavailable to browser (anon) callers.
REVOKE EXECUTE ON FUNCTION public.get_patient_portal_appointments(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text, text, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_patient_appointment(text, text, uuid, text) FROM anon;
