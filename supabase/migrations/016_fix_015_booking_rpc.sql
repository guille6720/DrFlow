-- Reparación si 015 falló en submit_public_booking (error p_first_name).
-- Idempotente: seguro correrlo aunque parte de 015 ya haya aplicado.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS booking_source TEXT NOT NULL DEFAULT 'manual';

DO $$ BEGIN
  ALTER TABLE appointments
    ADD CONSTRAINT appointments_booking_source_check
    CHECK (booking_source IN ('manual', 'online'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE appointments
SET booking_source = 'online'
WHERE booking_source = 'manual'
  AND notes ILIKE '%solicitud online%';

CREATE TABLE IF NOT EXISTS medical_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinical_record_id UUID REFERENCES clinical_records(id) ON DELETE SET NULL,
  professional_id UUID NOT NULL REFERENCES professionals(id),
  order_text TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE medical_orders
    ADD CONSTRAINT medical_orders_status_check
    CHECK (status IN ('draft', 'issued', 'void'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_medical_orders_clinic ON medical_orders(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_orders_patient ON medical_orders(patient_id, created_at DESC);

ALTER TABLE medical_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_orders_all ON medical_orders;
CREATE POLICY medical_orders_all ON medical_orders FOR ALL
  USING (can_view_clinical(clinic_id));

CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_slug TEXT,
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
    RAISE EXCEPTION 'Link de reserva inválido o inactivo';
  END IF;

  SELECT clinic_id INTO v_prof_clinic
  FROM professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'Profesional no válido para esta clínica';
  END IF;

  IF p_start_at < now() THEN
    RAISE EXCEPTION 'El horario seleccionado ya pasó';
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
    RAISE EXCEPTION 'El horario ya no está disponible';
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

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'patient_id', v_patient_id,
    'clinic_id', v_clinic_id,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_booking TO anon, authenticated;
