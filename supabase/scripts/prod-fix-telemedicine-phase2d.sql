-- Production fix: Fase 2D telemedicina integrada (migration 101).
-- Safe to re-run.

ALTER TABLE telemedicine_sessions
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'jitsi',
  ADD COLUMN IF NOT EXISTS external_room_id TEXT,
  ADD COLUMN IF NOT EXISTS patient_join_url TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE telemedicine_sessions
  DROP CONSTRAINT IF EXISTS telemedicine_sessions_provider_check;

ALTER TABLE telemedicine_sessions
  ADD CONSTRAINT telemedicine_sessions_provider_check
  CHECK (provider IN ('jitsi', 'daily'));

DROP FUNCTION IF EXISTS public.create_telemedicine_session_atomic(UUID, UUID, TEXT, telemedicine_status, UUID);

CREATE OR REPLACE FUNCTION public.create_telemedicine_session_atomic(
  p_clinic_id UUID,
  p_appointment_id UUID,
  p_room_url TEXT,
  p_status telemedicine_status,
  p_created_by UUID,
  p_provider TEXT DEFAULT 'jitsi',
  p_external_room_id TEXT DEFAULT NULL,
  p_patient_join_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session telemedicine_sessions%ROWTYPE;
BEGIN
  IF NOT can_view_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE id = p_appointment_id AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  INSERT INTO telemedicine_sessions (
    clinic_id,
    appointment_id,
    room_url,
    status,
    created_by,
    provider,
    external_room_id,
    patient_join_url,
    expires_at
  )
  VALUES (
    p_clinic_id,
    p_appointment_id,
    p_room_url,
    p_status,
    p_created_by,
    COALESCE(NULLIF(trim(p_provider), ''), 'jitsi'),
    p_external_room_id,
    p_patient_join_url,
    p_expires_at
  )
  ON CONFLICT (appointment_id) DO UPDATE SET
    room_url = EXCLUDED.room_url,
    provider = EXCLUDED.provider,
    external_room_id = EXCLUDED.external_room_id,
    patient_join_url = EXCLUDED.patient_join_url,
    expires_at = EXCLUDED.expires_at,
    status = CASE
      WHEN telemedicine_sessions.status = 'cancelled' THEN EXCLUDED.status
      ELSE telemedicine_sessions.status
    END
  RETURNING * INTO v_session;

  UPDATE appointments
  SET consultation_modality = 'virtual', updated_at = now()
  WHERE id = p_appointment_id AND clinic_id = p_clinic_id;

  RETURN to_jsonb(v_session);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_telemedicine_session_status(
  p_clinic_id UUID,
  p_session_id UUID,
  p_status telemedicine_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session telemedicine_sessions%ROWTYPE;
BEGIN
  IF NOT (
    is_superadmin()
    OR can_manage_clinic(p_clinic_id)
    OR is_doctor_in_clinic(p_clinic_id)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE telemedicine_sessions
  SET
    status = p_status,
    started_at = CASE
      WHEN p_status = 'active' THEN COALESCE(started_at, now())
      ELSE started_at
    END,
    ended_at = CASE
      WHEN p_status IN ('completed', 'cancelled') THEN COALESCE(ended_at, now())
      ELSE ended_at
    END
  WHERE id = p_session_id AND clinic_id = p_clinic_id
  RETURNING * INTO v_session;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  RETURN to_jsonb(v_session);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_telemedicine_session_atomic(
  UUID, UUID, TEXT, telemedicine_status, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_telemedicine_session_status(
  UUID, UUID, telemedicine_status
) TO authenticated;
