-- Tiempo de ingreso a sala de espera para el contador de la agenda.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS waiting_room_entered_at TIMESTAMPTZ;

COMMENT ON COLUMN appointments.waiting_room_entered_at IS
  'Momento en que el paciente ingresó a sala de espera (Presente o En espera).';

UPDATE appointments a
SET waiting_room_entered_at = h.changed_at
FROM (
  SELECT DISTINCT ON (appointment_id)
    appointment_id,
    changed_at
  FROM appointment_status_history
  WHERE to_waiting_room_status IN ('waiting', 'confirmed')
    AND from_waiting_room_status IS DISTINCT FROM to_waiting_room_status
  ORDER BY appointment_id, changed_at ASC
) h
WHERE a.id = h.appointment_id
  AND a.waiting_room_entered_at IS NULL
  AND a.waiting_room_status IN ('waiting', 'confirmed');

CREATE OR REPLACE FUNCTION public.update_waiting_room_status_atomic(
  p_clinic_id UUID,
  p_appointment_id UUID,
  p_waiting_room_status waiting_room_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row appointments%ROWTYPE;
  v_appt_status appointment_status;
  v_old_status appointment_status;
  v_old_waiting waiting_room_status;
  v_entered_at TIMESTAMPTZ;
  v_in_queue BOOLEAN;
  v_was_in_queue BOOLEAN;
BEGIN
  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'secretary', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_row
  FROM appointments
  WHERE id = p_appointment_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  v_old_status := v_row.status;
  v_old_waiting := v_row.waiting_room_status;
  v_in_queue := p_waiting_room_status IN ('waiting', 'confirmed');
  v_was_in_queue := v_old_waiting IN ('waiting', 'confirmed');

  IF v_in_queue THEN
    IF v_row.waiting_room_entered_at IS NOT NULL AND v_was_in_queue THEN
      v_entered_at := v_row.waiting_room_entered_at;
    ELSE
      v_entered_at := now();
    END IF;
  ELSE
    v_entered_at := v_row.waiting_room_entered_at;
  END IF;

  v_appt_status := CASE p_waiting_room_status
    WHEN 'absent' THEN 'no_show'::appointment_status
    WHEN 'cancelled' THEN 'cancelled'::appointment_status
    WHEN 'finished' THEN 'attended'::appointment_status
    ELSE v_row.status
  END;

  UPDATE appointments
  SET
    waiting_room_status = p_waiting_room_status,
    waiting_room_entered_at = v_entered_at,
    status = COALESCE(v_appt_status, status),
    updated_at = now()
  WHERE id = p_appointment_id;

  PERFORM public.append_appointment_status_history(
    p_clinic_id,
    p_appointment_id,
    v_old_status,
    COALESCE(v_appt_status, v_old_status),
    v_old_waiting,
    p_waiting_room_status,
    auth.uid(),
    'Sala de espera',
    '{}'::jsonb
  );

  SELECT * INTO v_row FROM appointments WHERE id = p_appointment_id;

  RETURN jsonb_build_object('data', to_jsonb(v_row));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_waiting_room_status_atomic(UUID, UUID, waiting_room_status)
  TO authenticated;
