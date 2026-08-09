-- Turnos module foundation: status history, waiting list, staff atomic booking, notification queue.

-- ---------------------------------------------------------------------------
-- Appointments: sobreturno + priority + insurance snapshot
-- ---------------------------------------------------------------------------
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS is_overbooking BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overbooking_reason TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS insurance_provider_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS insurance_plan_snapshot TEXT;

COMMENT ON COLUMN appointments.is_overbooking IS 'Sobreturno — fuera de cupo normal; requiere permiso y motivo.';
COMMENT ON COLUMN appointments.priority IS 'Prioridad operativa: normal | high | urgent';

-- ---------------------------------------------------------------------------
-- Historial de estados del turno
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  from_status appointment_status,
  to_status appointment_status NOT NULL,
  from_waiting_room_status waiting_room_status,
  to_waiting_room_status waiting_room_status,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_appointment_status_history_appointment
  ON appointment_status_history (appointment_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointment_status_history_clinic
  ON appointment_status_history (clinic_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- Lista de espera
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  specialty_id UUID REFERENCES specialties(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  preferred_date_from DATE,
  preferred_date_to DATE,
  preferred_time_from TIME,
  preferred_time_to TIME,
  consultation_modality TEXT NOT NULL DEFAULT 'presencial'
    CHECK (consultation_modality IN ('presencial', 'virtual')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'contacted', 'scheduled', 'cancelled')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiting_list_clinic_status
  ON waiting_list (clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waiting_list_patient
  ON waiting_list (clinic_id, patient_id);

-- ---------------------------------------------------------------------------
-- Cola de notificaciones desacoplada (WhatsApp / email / internal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('confirmation', 'reminder_48h', 'reminder_24h', 'cancellation', 'reschedule')
  ),
  channel reminder_channel NOT NULL,
  recipient TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status reminder_status NOT NULL DEFAULT 'queued',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_notification_queue_pending
  ON appointment_notification_queue (clinic_id, status, scheduled_for)
  WHERE status = 'queued';

-- ---------------------------------------------------------------------------
-- Helper: append appointment status history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_appointment_status_history(
  p_clinic_id UUID,
  p_appointment_id UUID,
  p_from_status appointment_status,
  p_to_status appointment_status,
  p_from_waiting waiting_room_status DEFAULT NULL,
  p_to_waiting waiting_room_status DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO appointment_status_history (
    clinic_id,
    appointment_id,
    from_status,
    to_status,
    from_waiting_room_status,
    to_waiting_room_status,
    changed_by,
    reason,
    metadata
  )
  VALUES (
    p_clinic_id,
    p_appointment_id,
    p_from_status,
    p_to_status,
    p_from_waiting,
    p_to_waiting,
    p_changed_by,
    NULLIF(trim(p_reason), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_appointment_status_history(
  UUID, UUID, appointment_status, appointment_status, waiting_room_status, waiting_room_status, UUID, TEXT, JSONB
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Staff appointment creation (atomic, overlap-safe unless sobreturno)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_staff_appointment_atomic(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_location_id UUID DEFAULT NULL,
  p_specialty_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_consultation_modality TEXT DEFAULT 'presencial',
  p_is_overbooking BOOLEAN DEFAULT false,
  p_overbooking_reason TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_insurance_provider TEXT DEFAULT NULL,
  p_insurance_plan TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id UUID;
  v_patient_clinic UUID;
  v_prof_clinic UUID;
BEGIN
  IF NOT (
    is_superadmin()
    OR can_manage_clinic(p_clinic_id)
    OR is_doctor_in_clinic(p_clinic_id)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'INVALID_TIME_RANGE';
  END IF;

  SELECT clinic_id INTO v_patient_clinic FROM patients WHERE id = p_patient_id;
  IF v_patient_clinic IS NULL OR v_patient_clinic <> p_clinic_id THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  SELECT clinic_id INTO v_prof_clinic
  FROM professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> p_clinic_id THEN
    RAISE EXCEPTION 'PROFESSIONAL_NOT_FOUND';
  END IF;

  IF p_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locations WHERE id = p_location_id AND clinic_id = p_clinic_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'LOCATION_NOT_FOUND';
  END IF;

  IF p_specialty_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM specialties WHERE id = p_specialty_id AND clinic_id = p_clinic_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'SPECIALTY_NOT_FOUND';
  END IF;

  IF p_is_overbooking AND (p_overbooking_reason IS NULL OR trim(p_overbooking_reason) = '') THEN
    RAISE EXCEPTION 'OVERBOOKING_REASON_REQUIRED';
  END IF;

  IF COALESCE(NULLIF(trim(p_consultation_modality), ''), 'presencial')
    NOT IN ('presencial', 'virtual') THEN
    RAISE EXCEPTION 'INVALID_MODALITY';
  END IF;

  IF NOT p_is_overbooking AND EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.professional_id = p_professional_id
      AND a.clinic_id = p_clinic_id
      AND a.status NOT IN ('cancelled'::appointment_status)
      AND a.start_at < p_end_at
      AND a.end_at > p_start_at
  ) THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM schedule_blocks sb
    WHERE sb.clinic_id = p_clinic_id
      AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)
      AND sb.start_at < p_end_at
      AND sb.end_at > p_start_at
  ) THEN
    RAISE EXCEPTION 'SLOT_BLOCKED';
  END IF;

  INSERT INTO appointments (
    clinic_id,
    patient_id,
    professional_id,
    location_id,
    specialty_id,
    start_at,
    end_at,
    status,
    notes,
    booking_source,
    consultation_modality,
    is_overbooking,
    overbooking_reason,
    priority,
    insurance_provider_snapshot,
    insurance_plan_snapshot,
    created_by
  )
  VALUES (
    p_clinic_id,
    p_patient_id,
    p_professional_id,
    p_location_id,
    p_specialty_id,
    p_start_at,
    p_end_at,
    'pending'::appointment_status,
    NULLIF(trim(p_notes), ''),
    'manual',
    COALESCE(NULLIF(trim(p_consultation_modality), ''), 'presencial'),
    COALESCE(p_is_overbooking, false),
    NULLIF(trim(p_overbooking_reason), ''),
    COALESCE(NULLIF(trim(p_priority), ''), 'normal'),
    NULLIF(trim(p_insurance_provider), ''),
    NULLIF(trim(p_insurance_plan), ''),
    p_created_by
  )
  RETURNING id INTO v_appointment_id;

  PERFORM public.append_appointment_status_history(
    p_clinic_id,
    v_appointment_id,
    NULL,
    'pending'::appointment_status,
    NULL,
    NULL,
    p_created_by,
    CASE WHEN p_is_overbooking THEN COALESCE(p_overbooking_reason, 'Sobreturno') ELSE 'Turno creado' END,
    jsonb_build_object('is_overbooking', COALESCE(p_is_overbooking, false), 'priority', COALESCE(p_priority, 'normal'))
  );

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_staff_appointment_atomic(
  UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, UUID
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Fix: doctors with manageWaitingRoom can update waiting room (align UI + RPC)
-- ---------------------------------------------------------------------------
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

  v_appt_status := CASE p_waiting_room_status
    WHEN 'absent' THEN 'no_show'::appointment_status
    WHEN 'cancelled' THEN 'cancelled'::appointment_status
    WHEN 'finished' THEN 'attended'::appointment_status
    ELSE v_row.status
  END;

  UPDATE appointments
  SET
    waiting_room_status = p_waiting_room_status,
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE appointment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_status_history_select ON appointment_status_history;
CREATE POLICY appointment_status_history_select ON appointment_status_history
  FOR SELECT USING (
    is_superadmin() OR clinic_id IN (SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS appointment_status_history_insert ON appointment_status_history;
CREATE POLICY appointment_status_history_insert ON appointment_status_history
  FOR INSERT WITH CHECK (
    is_superadmin() OR can_manage_clinic(clinic_id) OR is_doctor_in_clinic(clinic_id)
  );

DROP POLICY IF EXISTS waiting_list_select ON waiting_list;
CREATE POLICY waiting_list_select ON waiting_list
  FOR SELECT USING (
    is_superadmin() OR clinic_id IN (SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS waiting_list_write ON waiting_list;
CREATE POLICY waiting_list_write ON waiting_list
  FOR ALL USING (
    is_superadmin() OR can_manage_clinic(clinic_id) OR is_doctor_in_clinic(clinic_id)
  )
  WITH CHECK (
    is_superadmin() OR can_manage_clinic(clinic_id) OR is_doctor_in_clinic(clinic_id)
  );

DROP POLICY IF EXISTS appointment_notification_queue_select ON appointment_notification_queue;
CREATE POLICY appointment_notification_queue_select ON appointment_notification_queue
  FOR SELECT USING (
    is_superadmin() OR can_manage_clinic(clinic_id)
  );

DROP POLICY IF EXISTS appointment_notification_queue_insert ON appointment_notification_queue;
CREATE POLICY appointment_notification_queue_insert ON appointment_notification_queue
  FOR INSERT WITH CHECK (
    is_superadmin() OR can_manage_clinic(clinic_id) OR is_doctor_in_clinic(clinic_id)
  );

DROP POLICY IF EXISTS appointment_notification_queue_update ON appointment_notification_queue;
CREATE POLICY appointment_notification_queue_update ON appointment_notification_queue
  FOR UPDATE USING (
    is_superadmin() OR can_manage_clinic(clinic_id)
  );
