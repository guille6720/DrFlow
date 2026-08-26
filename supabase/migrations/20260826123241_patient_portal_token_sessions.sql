-- Reconcile remote Staging migration 20260826123241_patient_portal_token_sessions
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.
-- Idempotent recreation for local history parity.

CREATE TABLE IF NOT EXISTS public.patient_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['appointments:read','appointments:cancel','consent:write']::text[],
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_portal_sessions_clinic_patient
  ON public.patient_portal_sessions (clinic_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_portal_sessions_expires_at
  ON public.patient_portal_sessions (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.patient_portal_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.patient_portal_sessions IS
  'Hashed magic-link sessions for patient portal. Raw token never stored.';

CREATE OR REPLACE FUNCTION public._resolve_patient_portal_session(
  p_token text,
  p_required_scope text
)
RETURNS TABLE(session_id uuid, clinic_id uuid, patient_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_hash bytea;
  v_session_id uuid;
  v_clinic_id uuid;
  v_patient_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_PORTAL_SESSION';
  END IF;
  IF p_required_scope IS NULL OR p_required_scope NOT IN ('appointments:read','appointments:cancel','consent:write') THEN
    RAISE EXCEPTION 'INVALID_PORTAL_SESSION';
  END IF;

  v_hash := extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256');

  SELECT s.id, s.clinic_id, s.patient_id, s.expires_at
    INTO v_session_id, v_clinic_id, v_patient_id, v_expires_at
  FROM public.patient_portal_sessions s
  WHERE s.token_hash = v_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > pg_catalog.now()
    AND p_required_scope = ANY(s.scopes)
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PORTAL_SESSION';
  END IF;

  UPDATE public.patient_portal_sessions
  SET last_used_at = pg_catalog.now()
  WHERE id = v_session_id;

  RETURN QUERY SELECT v_session_id, v_clinic_id, v_patient_id, v_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public._resolve_patient_portal_session(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._resolve_patient_portal_session(text, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_patient_portal_session(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_expires_minutes integer DEFAULT 30,
  p_scopes text[] DEFAULT ARRAY['appointments:read','appointments:cancel','consent:write']::text[]
)
RETURNS TABLE(session_id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token text;
  v_token_hash bytea;
  v_expires_at timestamptz;
  v_session_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_expires_minutes IS NULL OR p_expires_minutes < 5 OR p_expires_minutes > 1440 THEN
    RAISE EXCEPTION 'INVALID_EXPIRY';
  END IF;

  IF p_scopes IS NULL
     OR pg_catalog.cardinality(p_scopes) = 0
     OR NOT (p_scopes <@ ARRAY['appointments:read','appointments:cancel','consent:write']::text[]) THEN
    RAISE EXCEPTION 'INVALID_SCOPES';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_user_id AND pr.is_superadmin = true
  ) AND NOT EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = p_clinic_id
      AND cm.user_id = v_user_id
      AND cm.is_active = true
      AND cm.role IN ('clinic_admin'::public.user_role, 'doctor'::public.user_role, 'secretary'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = p_patient_id
      AND p.clinic_id = p_clinic_id
      AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256');
  v_expires_at := pg_catalog.now() + pg_catalog.make_interval(mins => p_expires_minutes);

  INSERT INTO public.patient_portal_sessions (
    clinic_id, patient_id, token_hash, scopes, expires_at, created_by
  ) VALUES (
    p_clinic_id, p_patient_id, v_token_hash, p_scopes, v_expires_at, v_user_id
  )
  RETURNING id INTO v_session_id;

  RETURN QUERY SELECT v_session_id, v_token, v_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_patient_portal_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinic_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT s.clinic_id INTO v_clinic_id
  FROM public.patient_portal_sessions s
  WHERE s.id = p_session_id;

  IF v_clinic_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_user_id AND pr.is_superadmin = true
  ) AND NOT EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = v_clinic_id
      AND cm.user_id = v_user_id
      AND cm.is_active = true
      AND cm.role IN ('clinic_admin'::public.user_role, 'doctor'::public.user_role, 'secretary'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.patient_portal_sessions
  SET revoked_at = COALESCE(revoked_at, pg_catalog.now())
  WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_patient_portal_session(uuid, uuid, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_patient_portal_session(uuid, uuid, integer, text[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.revoke_patient_portal_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_patient_portal_session(uuid) TO authenticated, service_role;
