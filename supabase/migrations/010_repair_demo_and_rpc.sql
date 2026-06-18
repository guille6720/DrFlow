-- Reparación idempotente: pacientes demo + RPC de reserva pública
-- Corré esto si check:supabase marca submit_public_booking o pacientes demo faltantes.

INSERT INTO patients (clinic_id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider, insurance_number, allergies, regular_medication)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'María', 'González', '30123456', '1985-03-15', '+54 11 5555-0001', 'maria.gonzalez@email.demo', 'OSDE', '123456789', 'Penicilina', 'Losartán 50mg'),
  ('a0000000-0000-4000-8000-000000000001', 'Carlos', 'Ruiz', '28456789', '1978-11-22', '+54 11 5555-0002', 'carlos.ruiz@email.demo', 'Swiss Medical', '987654321', NULL, NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Lucía', 'Fernández', '45123456', '2018-07-08', '+54 11 5555-0003', 'lucia.fernandez@email.demo', 'Galeno', '456789123', 'Polen', NULL)
ON CONFLICT (clinic_id, document_number) DO NOTHING;

INSERT INTO appointments (clinic_id, patient_id, professional_id, location_id, specialty_id, start_at, end_at, status, notes)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  pat.id,
  pro.id,
  pro.location_id,
  pro.specialty_id,
  slot.start_at,
  slot.start_at + interval '30 minutes',
  slot.status::appointment_status,
  slot.notes
FROM (VALUES
  ('30123456', 'b0000000-0000-4000-8000-000000000001', date_trunc('day', now()) + interval '10 hours', 'confirmed'::appointment_status, 'Control anual'),
  ('28456789', 'b0000000-0000-4000-8000-000000000002', date_trunc('day', now()) + interval '11 hours', 'pending'::appointment_status, 'Consulta pediátrica'),
  ('45123456', 'b0000000-0000-4000-8000-000000000003', date_trunc('day', now()) + interval '1 day' + interval '15 hours', 'pending'::appointment_status, 'Electrocardiograma')
) AS slot(doc, pro_id, start_at, status, notes)
JOIN patients pat ON pat.document_number = slot.doc AND pat.clinic_id = 'a0000000-0000-4000-8000-000000000001'
JOIN professionals pro ON pro.id = slot.pro_id::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.professional_id = pro.id
    AND a.start_at = slot.start_at
    AND a.status NOT IN ('cancelled'::appointment_status)
);

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
    start_at, end_at, status, notes
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
    COALESCE(p_reason, 'Solicitud online')
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
