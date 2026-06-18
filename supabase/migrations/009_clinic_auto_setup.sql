-- Auto-setup clínica nueva: sede, especialidad, profesional admin, link público y horarios base

CREATE OR REPLACE FUNCTION setup_user_clinic(
  p_name text,
  p_slug text,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_user_id uuid := auth.uid();
  v_email text;
  v_spec_id uuid;
  v_loc_id uuid;
  v_pro_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM clinic_members WHERE user_id = v_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ALREADY_HAS_CLINIC';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT id INTO v_clinic_id FROM clinics WHERE slug = p_slug;

  IF v_clinic_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM clinic_members WHERE clinic_id = v_clinic_id) THEN
      RAISE EXCEPTION 'SLUG_TAKEN';
    END IF;
    UPDATE clinics SET name = p_name, email = v_email, phone = p_phone WHERE id = v_clinic_id;
  ELSE
    INSERT INTO clinics (name, slug, email, phone)
    VALUES (p_name, p_slug, v_email, p_phone)
    RETURNING id INTO v_clinic_id;
  END IF;

  INSERT INTO clinic_members (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_user_id, 'clinic_admin');

  INSERT INTO specialties (clinic_id, name)
  SELECT v_clinic_id, 'Medicina general'
  WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE clinic_id = v_clinic_id);

  SELECT id INTO v_spec_id FROM specialties WHERE clinic_id = v_clinic_id LIMIT 1;

  INSERT INTO locations (clinic_id, name)
  SELECT v_clinic_id, 'Consultorio principal'
  WHERE NOT EXISTS (SELECT 1 FROM locations WHERE clinic_id = v_clinic_id);

  SELECT id INTO v_loc_id FROM locations WHERE clinic_id = v_clinic_id LIMIT 1;

  INSERT INTO professionals (clinic_id, user_id, specialty_id, location_id, display_name, is_active)
  SELECT v_clinic_id, v_user_id, v_spec_id, v_loc_id,
    COALESCE((SELECT full_name FROM profiles WHERE id = v_user_id), 'Profesional'),
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM professionals WHERE clinic_id = v_clinic_id AND user_id = v_user_id
  )
  RETURNING id INTO v_pro_id;

  IF v_pro_id IS NULL THEN
    SELECT id INTO v_pro_id FROM professionals WHERE clinic_id = v_clinic_id AND user_id = v_user_id LIMIT 1;
  END IF;

  INSERT INTO public_booking_links (clinic_id, slug, professional_id, is_active)
  VALUES (v_clinic_id, p_slug, v_pro_id, true)
  ON CONFLICT (slug) DO UPDATE SET is_active = true, professional_id = EXCLUDED.professional_id;

  INSERT INTO availability_rules (professional_id, clinic_id, day_of_week, start_time, end_time, slot_duration, location_id)
  SELECT v_pro_id, v_clinic_id, d, '09:00'::time, '18:00'::time, 30, v_loc_id
  FROM generate_series(1, 5) AS d
  WHERE NOT EXISTS (
    SELECT 1 FROM availability_rules WHERE professional_id = v_pro_id AND day_of_week = d
  );

  INSERT INTO consultation_reasons (clinic_id, name)
  SELECT v_clinic_id, 'Consulta general'
  WHERE NOT EXISTS (SELECT 1 FROM consultation_reasons WHERE clinic_id = v_clinic_id AND name = 'Consulta general');

  INSERT INTO consultation_reasons (clinic_id, name)
  SELECT v_clinic_id, 'Control'
  WHERE NOT EXISTS (SELECT 1 FROM consultation_reasons WHERE clinic_id = v_clinic_id AND name = 'Control');

  RETURN v_clinic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION setup_user_clinic(text, text, text) TO authenticated;
