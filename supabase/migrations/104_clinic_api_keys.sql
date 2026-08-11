-- Fase 4C: API pública — claves por clínica + RPCs de lectura/escritura acotados.

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_booking_source_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_booking_source_check
  CHECK (booking_source IN ('manual', 'online', 'api'));

CREATE TABLE IF NOT EXISTS clinic_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['appointments:read', 'professionals:read'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clinic_api_keys_clinic
  ON clinic_api_keys (clinic_id, is_active);

CREATE INDEX IF NOT EXISTS idx_clinic_api_keys_hash_active
  ON clinic_api_keys (key_hash)
  WHERE is_active = true AND revoked_at IS NULL;

ALTER TABLE clinic_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_api_keys_select ON clinic_api_keys;
CREATE POLICY clinic_api_keys_select ON clinic_api_keys FOR SELECT
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) IN ('clinic_admin', 'secretary')
  );

DROP POLICY IF EXISTS clinic_api_keys_manage ON clinic_api_keys;
CREATE POLICY clinic_api_keys_manage ON clinic_api_keys FOR ALL
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  )
  WITH CHECK (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

-- Plugin gate (optional — default off for new clinics)
INSERT INTO clinic_plugins (clinic_id, plugin_id, enabled)
SELECT c.id, 'public_api', false
FROM clinics c
ON CONFLICT (clinic_id, plugin_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Read appointments (non-clinical fields)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_list_appointments(
  p_clinic_id UUID,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  professional_id UUID,
  professional_name TEXT,
  patient_id UUID,
  patient_name TEXT,
  document_last4 TEXT,
  booking_source TEXT,
  consultation_modality TEXT,
  location_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.status::TEXT,
    a.start_at,
    a.end_at,
    a.professional_id,
    COALESCE(pro.display_name, prof.full_name) AS professional_name,
    a.patient_id,
    trim(concat(p.last_name, ', ', p.first_name)) AS patient_name,
    CASE
      WHEN length(trim(p.document_number)) >= 4
        THEN right(trim(p.document_number), 4)
      ELSE NULL
    END AS document_last4,
    a.booking_source,
    a.consultation_modality::TEXT,
    a.location_id
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN professionals pro ON pro.id = a.professional_id
  LEFT JOIN profiles prof ON prof.id = pro.user_id
  WHERE a.clinic_id = p_clinic_id
    AND (p_from IS NULL OR a.start_at >= p_from)
    AND (p_to IS NULL OR a.start_at < p_to)
    AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
    AND (p_status IS NULL OR a.status::TEXT = p_status)
  ORDER BY a.start_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
$$;

GRANT EXECUTE ON FUNCTION public.api_list_appointments(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_get_appointment(
  p_clinic_id UUID,
  p_appointment_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', a.id,
    'status', a.status::TEXT,
    'start_at', a.start_at,
    'end_at', a.end_at,
    'professional_id', a.professional_id,
    'professional_name', COALESCE(pro.display_name, prof.full_name),
    'patient_id', a.patient_id,
    'patient_name', trim(concat(p.last_name, ', ', p.first_name)),
    'document_last4',
      CASE
        WHEN length(trim(p.document_number)) >= 4 THEN right(trim(p.document_number), 4)
        ELSE NULL
      END,
    'phone', p.phone,
    'insurance_provider', COALESCE(a.insurance_provider_snapshot, p.insurance_provider),
    'booking_source', a.booking_source,
    'consultation_modality', a.consultation_modality::TEXT,
    'location_id', a.location_id,
    'created_at', a.created_at
  )
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN professionals pro ON pro.id = a.professional_id
  LEFT JOIN profiles prof ON prof.id = pro.user_id
  WHERE a.clinic_id = p_clinic_id AND a.id = p_appointment_id;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_appointment(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_list_professionals(p_clinic_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  specialty_id UUID,
  specialty_name TEXT,
  location_id UUID,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pro.id,
    COALESCE(pro.display_name, prof.full_name) AS display_name,
    pro.specialty_id,
    sp.name AS specialty_name,
    pro.location_id,
    pro.is_active
  FROM professionals pro
  LEFT JOIN profiles prof ON prof.id = pro.user_id
  LEFT JOIN specialties sp ON sp.id = pro.specialty_id
  WHERE pro.clinic_id = p_clinic_id AND pro.is_active = true
  ORDER BY display_name;
$$;

GRANT EXECUTE ON FUNCTION public.api_list_professionals(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_get_booking_occupancy(
  p_clinic_id UUID,
  p_professional_id UUID,
  p_from TIMESTAMPTZ DEFAULT now(),
  p_to TIMESTAMPTZ DEFAULT (now() + interval '21 days')
)
RETURNS TABLE (start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.start_at, a.end_at
  FROM appointments a
  WHERE a.clinic_id = p_clinic_id
    AND a.professional_id = p_professional_id
    AND a.status NOT IN ('cancelled'::appointment_status)
    AND a.start_at < p_to
    AND a.end_at > p_from;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_booking_occupancy(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_submit_appointment(
  p_clinic_id UUID,
  p_professional_id UUID,
  p_start_at TIMESTAMPTZ,
  p_first_name TEXT,
  p_last_name TEXT,
  p_document_number TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_appointment_id UUID;
  v_duration INTEGER;
  v_end_at TIMESTAMPTZ;
  v_prof_clinic UUID;
BEGIN
  SELECT clinic_id INTO v_prof_clinic
  FROM professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> p_clinic_id THEN
    PERFORM raise_app_error(
      'INVALID_PROFESSIONAL_FOR_CLINIC',
      'Profesional no válido para esta clínica'
    );
  END IF;

  IF p_start_at < now() THEN
    PERFORM raise_app_error('BOOKING_SLOT_IN_PAST', 'El horario seleccionado ya pasó');
  END IF;

  SELECT default_appointment_duration INTO v_duration FROM clinics WHERE id = p_clinic_id;
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
  WHERE clinic_id = p_clinic_id AND document_number = trim(p_document_number);

  IF v_patient_id IS NULL THEN
    INSERT INTO patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (
      p_clinic_id,
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
    p_clinic_id,
    v_patient_id,
    p_professional_id,
    pro.location_id,
    pro.specialty_id,
    p_start_at,
    v_end_at,
    'pending'::appointment_status,
    COALESCE(p_reason, 'Reserva vía API'),
    'api'
  FROM professionals pro
  WHERE pro.id = p_professional_id
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'patient_id', v_patient_id,
    'clinic_id', p_clinic_id,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_submit_appointment(
  UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON TABLE clinic_api_keys IS 'Claves Bearer para API pública /api/v1 (Fase 4C).';
