/* Mejora seed_demo_patients_for_clinic: permisos, consultas demo y mas turnos */

CREATE OR REPLACE FUNCTION public.seed_demo_patients_for_clinic(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_clinic UUID := 'a0000000-0000-4000-8000-000000000001';
  v_patients INTEGER := 0;
  v_records INTEGER := 0;
  v_appointments INTEGER := 0;
  v_pro_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM clinic_members cm
    WHERE cm.clinic_id = p_clinic_id
      AND cm.user_id = v_user_id
      AND cm.is_active = true
      AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = v_user_id AND p.is_superadmin = true
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO patients (
    clinic_id, first_name, last_name, document_number, birth_date, phone, email,
    insurance_provider, insurance_number, allergies, regular_medication, medical_history, notes
  )
  SELECT
    p_clinic_id, first_name, last_name, document_number, birth_date, phone, email,
    insurance_provider, insurance_number, allergies, regular_medication, medical_history, notes
  FROM patients
  WHERE clinic_id = v_demo_clinic
  ON CONFLICT (clinic_id, document_number) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    insurance_provider = EXCLUDED.insurance_provider,
    allergies = EXCLUDED.allergies,
    regular_medication = EXCLUDED.regular_medication,
    medical_history = EXCLUDED.medical_history,
    notes = EXCLUDED.notes,
    updated_at = now();

  GET DIAGNOSTICS v_patients = ROW_COUNT;

  SELECT id INTO v_pro_id
  FROM professionals
  WHERE clinic_id = p_clinic_id AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_pro_id IS NOT NULL THEN
    INSERT INTO appointments (
      clinic_id, patient_id, professional_id, start_at, end_at, status, notes, booking_source
    )
    SELECT
      p_clinic_id,
      p.id,
      v_pro_id,
      slot.start_at,
      slot.start_at + interval '30 minutes',
      slot.status::appointment_status,
      slot.notes,
      slot.booking_source
    FROM (VALUES
      ('30123456', date_trunc('day', now()) + interval '9 hours',  'confirmed'::appointment_status, 'Control HTA', 'manual'),
      ('29876543', date_trunc('day', now()) + interval '10 hours', 'pending'::appointment_status, 'Cefalea / migraña', 'manual'),
      ('45123456', date_trunc('day', now()) + interval '11 hours', 'pending'::appointment_status, 'Control pediátrico', 'manual'),
      ('32456789', date_trunc('day', now()) + interval '15 hours', 'pending'::appointment_status, 'Control diabetes', 'manual')
    ) AS slot(doc, start_at, status, notes, booking_source)
    JOIN patients p ON p.document_number = slot.doc AND p.clinic_id = p_clinic_id
    WHERE NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.patient_id = p.id
        AND a.start_at = slot.start_at
        AND a.status NOT IN ('cancelled'::appointment_status)
    );

    GET DIAGNOSTICS v_appointments = ROW_COUNT;
  END IF;

  IF v_pro_id IS NOT NULL THEN
    INSERT INTO clinical_records (
      clinic_id, patient_id, professional_id, chief_complaint, diagnosis, evolution,
      indications, created_by
    )
    SELECT
      p_clinic_id,
      p_target.id,
      v_pro_id,
      cr.chief_complaint,
      cr.diagnosis,
      cr.evolution,
      cr.indications,
      v_user_id
    FROM clinical_records cr
    JOIN patients p_source ON p_source.id = cr.patient_id AND p_source.clinic_id = v_demo_clinic
    JOIN patients p_target
      ON p_target.clinic_id = p_clinic_id
      AND p_target.document_number = p_source.document_number
    WHERE cr.clinic_id = v_demo_clinic
      AND NOT EXISTS (
        SELECT 1 FROM clinical_records existing
        WHERE existing.patient_id = p_target.id
          AND existing.diagnosis IS NOT DISTINCT FROM cr.diagnosis
      );

    GET DIAGNOSTICS v_records = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'patients_upserted', v_patients,
    'clinical_records', v_records,
    'appointments', v_appointments,
    'demo_professional_used', v_pro_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_patients_for_clinic(UUID) TO authenticated;
