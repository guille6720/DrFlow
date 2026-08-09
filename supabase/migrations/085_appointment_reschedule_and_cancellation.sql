-- Phase 2 turnos: structured cancellation, reschedule atomic RPC, notification on reschedule.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancellation_category TEXT
    CHECK (cancellation_category IS NULL OR cancellation_category IN (
      'patient', 'professional', 'clinic', 'data_error', 'other'
    )),
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN appointments.cancellation_category IS 'Motivo estructurado de cancelación.';
COMMENT ON COLUMN appointments.rescheduled_at IS 'Última reprogramación del turno (misma fila, nueva fecha/hora).';

CREATE INDEX IF NOT EXISTS idx_appointments_rescheduled
  ON appointments (clinic_id, rescheduled_at DESC)
  WHERE rescheduled_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Reprogramar turno (atómico, anti-solapamiento)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reschedule_appointment_atomic(
  p_clinic_id UUID,
  p_appointment_id UUID,
  p_new_start_at TIMESTAMPTZ,
  p_new_end_at TIMESTAMPTZ,
  p_changed_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row appointments%ROWTYPE;
  v_professional_id UUID;
BEGIN
  IF NOT (
    is_superadmin()
    OR can_manage_clinic(p_clinic_id)
    OR is_doctor_in_clinic(p_clinic_id)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_new_end_at <= p_new_start_at THEN
    RAISE EXCEPTION 'INVALID_TIME_RANGE';
  END IF;

  SELECT * INTO v_row
  FROM appointments
  WHERE id = p_appointment_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  IF v_row.status IN ('cancelled'::appointment_status, 'attended'::appointment_status) THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_RESCHEDULABLE';
  END IF;

  v_professional_id := v_row.professional_id;

  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.professional_id = v_professional_id
      AND a.clinic_id = p_clinic_id
      AND a.id <> p_appointment_id
      AND a.status NOT IN ('cancelled'::appointment_status)
      AND a.start_at < p_new_end_at
      AND a.end_at > p_new_start_at
  ) THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM schedule_blocks sb
    WHERE sb.clinic_id = p_clinic_id
      AND (sb.professional_id IS NULL OR sb.professional_id = v_professional_id)
      AND sb.start_at < p_new_end_at
      AND sb.end_at > p_new_start_at
  ) THEN
    RAISE EXCEPTION 'SLOT_BLOCKED';
  END IF;

  UPDATE appointments
  SET
    start_at = p_new_start_at,
    end_at = p_new_end_at,
    rescheduled_at = now(),
    updated_at = now()
  WHERE id = p_appointment_id;

  PERFORM public.append_appointment_status_history(
    p_clinic_id,
    p_appointment_id,
    v_row.status,
    v_row.status,
    v_row.waiting_room_status,
    v_row.waiting_room_status,
    p_changed_by,
    COALESCE(NULLIF(trim(p_reason), ''), 'Turno reprogramado'),
    jsonb_build_object(
      'rescheduled', true,
      'from_start_at', v_row.start_at,
      'from_end_at', v_row.end_at,
      'to_start_at', p_new_start_at,
      'to_end_at', p_new_end_at
    )
  );

  INSERT INTO appointment_notification_queue (
    clinic_id,
    appointment_id,
    event_type,
    channel,
    recipient,
    payload,
    scheduled_for
  )
  SELECT
    p_clinic_id,
    p_appointment_id,
    'reschedule',
    'internal',
    COALESCE(p.phone, p.email, 'patient'),
    jsonb_build_object(
      'patient_id', v_row.patient_id,
      'from_start_at', v_row.start_at,
      'to_start_at', p_new_start_at,
      'reason', NULLIF(trim(p_reason), '')
    ),
    now()
  FROM patients p
  WHERE p.id = v_row.patient_id;

  RETURN jsonb_build_object(
    'appointment_id', p_appointment_id,
    'from_start_at', v_row.start_at,
    'to_start_at', p_new_start_at,
    'status', v_row.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment_atomic(
  UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT
) TO authenticated;
