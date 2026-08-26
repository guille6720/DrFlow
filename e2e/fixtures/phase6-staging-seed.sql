-- Phase 6 E2E synthetic seed (STAGING ONLY). Idempotent upserts.
-- Tokens are inserted as hashes only; raw tokens stay in the test runner.

DO $$
DECLARE
  v_clinic_a uuid := 'a0000000-0000-4000-8000-000000000001';
  v_clinic_b uuid;
  v_prof uuid := 'b0000000-0000-4000-8000-000000000001';
  v_patient_a uuid;
  v_patient_b uuid;
  v_patient_existing uuid;
  v_appt_a uuid;
  v_appt_b uuid;
  v_start timestamptz := date_trunc('hour', now() + interval '3 days') + interval '10 hours';
BEGIN
  SELECT clinic_id INTO v_clinic_b
  FROM public.public_booking_links
  WHERE slug = 'mi-clinica-abuelitos' AND is_active = true
  LIMIT 1;

  -- Patient A (portal owner)
  INSERT INTO public.patients (
    clinic_id, first_name, last_name, document_number, phone, email
  ) VALUES (
    v_clinic_a, 'E2EPhase6', 'PortalA', '90060001', '1111111111', 'e2e-phase6-a@example.test'
  )
  ON CONFLICT DO NOTHING;

  -- Prefer unique (clinic_id, document_number) if constraint exists
  SELECT id INTO v_patient_a FROM public.patients
  WHERE clinic_id = v_clinic_a AND document_number = '90060001'
  LIMIT 1;

  IF v_patient_a IS NULL THEN
    INSERT INTO public.patients (
      clinic_id, first_name, last_name, document_number, phone, email
    ) VALUES (
      v_clinic_a, 'E2EPhase6', 'PortalA', '90060001', '1111111111', 'e2e-phase6-a@example.test'
    ) RETURNING id INTO v_patient_a;
  ELSE
    UPDATE public.patients SET
      first_name = 'E2EPhase6',
      last_name = 'PortalA',
      phone = '1111111111',
      email = 'e2e-phase6-a@example.test'
    WHERE id = v_patient_a;
  END IF;

  -- Patient B (other patient, same clinic)
  SELECT id INTO v_patient_b FROM public.patients
  WHERE clinic_id = v_clinic_a AND document_number = '90060002'
  LIMIT 1;
  IF v_patient_b IS NULL THEN
    INSERT INTO public.patients (
      clinic_id, first_name, last_name, document_number, phone, email
    ) VALUES (
      v_clinic_a, 'E2EPhase6', 'PortalB', '90060002', '2222222222', 'e2e-phase6-b@example.test'
    ) RETURNING id INTO v_patient_b;
  END IF;

  -- Existing demographics patient (must not be overwritten by public booking)
  SELECT id INTO v_patient_existing FROM public.patients
  WHERE clinic_id = v_clinic_a AND document_number = '90060003'
  LIMIT 1;
  IF v_patient_existing IS NULL THEN
    INSERT INTO public.patients (
      clinic_id, first_name, last_name, document_number, phone, email
    ) VALUES (
      v_clinic_a, 'KeepFirst', 'KeepLast', '90060003', '3333333333', 'keep@example.test'
    ) RETURNING id INTO v_patient_existing;
  ELSE
    UPDATE public.patients SET
      first_name = 'KeepFirst',
      last_name = 'KeepLast',
      phone = '3333333333',
      email = 'keep@example.test'
    WHERE id = v_patient_existing;
  END IF;

  -- Clean prior synthetic online appointments for these patients in the window
  DELETE FROM public.appointments
  WHERE clinic_id = v_clinic_a
    AND patient_id IN (v_patient_a, v_patient_b)
    AND booking_source = 'online'
    AND notes LIKE 'E2E Phase6%';

  INSERT INTO public.appointments (
    clinic_id, patient_id, professional_id, start_at, end_at, status, notes, booking_source
  ) VALUES (
    v_clinic_a, v_patient_a, v_prof,
    v_start, v_start + interval '30 minutes',
    'pending', 'E2E Phase6 own appointment', 'online'
  ) RETURNING id INTO v_appt_a;

  INSERT INTO public.appointments (
    clinic_id, patient_id, professional_id, start_at, end_at, status, notes, booking_source
  ) VALUES (
    v_clinic_a, v_patient_b, v_prof,
    v_start + interval '1 hour', v_start + interval '90 minutes',
    'confirmed', 'E2E Phase6 other patient appointment', 'online'
  ) RETURNING id INTO v_appt_b;

  RAISE NOTICE 'phase6_seed patient_a=% patient_b=% existing=% appt_a=% appt_b=% clinic_b=%',
    v_patient_a, v_patient_b, v_patient_existing, v_appt_a, v_appt_b, v_clinic_b;
END $$;

SELECT
  (SELECT id::text FROM public.patients WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001' AND document_number = '90060001' LIMIT 1) AS patient_a,
  (SELECT id::text FROM public.patients WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001' AND document_number = '90060002' LIMIT 1) AS patient_b,
  (SELECT id::text FROM public.patients WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001' AND document_number = '90060003' LIMIT 1) AS patient_existing,
  (SELECT id::text FROM public.appointments WHERE notes = 'E2E Phase6 own appointment' ORDER BY created_at DESC LIMIT 1) AS appt_a,
  (SELECT id::text FROM public.appointments WHERE notes = 'E2E Phase6 other patient appointment' ORDER BY created_at DESC LIMIT 1) AS appt_b;
