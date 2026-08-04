-- Schema ↔ code parity fixes (idempotent, no data deletion).
-- 1. clinic_members.professional_id (PAMI planillas + doctor identity)
-- 2. setup_user_clinic sets professional_id + seeds all feature flags
-- 3. Re-sync patients.notes → patient_clinical_profiles (post-047 drift)
-- 4. admin_ops_assistant flag backfill (same as 056, safe to re-run)

-- ---------------------------------------------------------------------------
-- clinic_members.professional_id
-- ---------------------------------------------------------------------------
ALTER TABLE clinic_members
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_members_professional
  ON clinic_members(professional_id)
  WHERE professional_id IS NOT NULL;

COMMENT ON COLUMN clinic_members.professional_id IS
  'Professional row linked to this membership (doctors). Set by setup_user_clinic or backfill.';

UPDATE clinic_members cm
SET professional_id = p.id,
    updated_at = now()
FROM professionals p
WHERE cm.professional_id IS NULL
  AND cm.user_id = p.user_id
  AND cm.clinic_id = p.clinic_id
  AND p.is_active = true;

-- ---------------------------------------------------------------------------
-- patients.notes drift → patient_clinical_profiles (047 moved PHI; preserve writes)
-- ---------------------------------------------------------------------------
INSERT INTO patient_clinical_profiles (patient_id, clinic_id, notes)
SELECT p.id, p.clinic_id, p.notes
FROM patients p
WHERE p.notes IS NOT NULL
  AND trim(p.notes) <> ''
ON CONFLICT (patient_id) DO UPDATE SET
  notes = CASE
    WHEN patient_clinical_profiles.notes IS NULL OR trim(patient_clinical_profiles.notes) = ''
      THEN EXCLUDED.notes
    WHEN patient_clinical_profiles.notes LIKE '%' || EXCLUDED.notes || '%'
      THEN patient_clinical_profiles.notes
    ELSE patient_clinical_profiles.notes || E'\n' || EXCLUDED.notes
  END,
  updated_at = now();

UPDATE patients
SET notes = NULL,
    updated_at = now()
WHERE notes IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Feature flag: admin_ops_assistant (056 backfill — idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO clinic_feature_flags (clinic_id, flag_id, enabled)
SELECT c.id, 'admin_ops_assistant', true
FROM clinics c
ON CONFLICT (clinic_id, flag_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- setup_user_clinic: link professional_id + seed feature flags for new clinics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION setup_user_clinic(
  p_name text,
  p_slug text,
  p_phone text,
  p_doctor_first_name text,
  p_doctor_last_name text,
  p_document_number text,
  p_specialty text,
  p_license_national text,
  p_license_provincial text DEFAULT NULL
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
  v_full_name text;
  v_license_prov text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'PHONE_REQUIRED';
  END IF;

  IF p_license_national IS NULL OR trim(p_license_national) = '' THEN
    RAISE EXCEPTION 'LICENSE_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM clinic_members WHERE user_id = v_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ALREADY_HAS_CLINIC';
  END IF;

  v_full_name := trim(p_doctor_first_name) || ' ' || trim(p_doctor_last_name);
  v_license_prov := COALESCE(NULLIF(trim(p_license_provincial), ''), trim(p_license_national));

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT id INTO v_clinic_id FROM clinics WHERE slug = p_slug;

  IF v_clinic_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM clinic_members WHERE clinic_id = v_clinic_id) THEN
      RAISE EXCEPTION 'SLUG_TAKEN';
    END IF;
    UPDATE clinics SET name = p_name, email = v_email, phone = trim(p_phone) WHERE id = v_clinic_id;
  ELSE
    INSERT INTO clinics (name, slug, email, phone)
    VALUES (p_name, p_slug, v_email, trim(p_phone))
    RETURNING id INTO v_clinic_id;
  END IF;

  UPDATE profiles
  SET
    full_name = v_full_name,
    phone = trim(p_phone),
    document_number = trim(p_document_number)
  WHERE id = v_user_id;

  INSERT INTO clinic_members (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_user_id, 'clinic_admin');

  INSERT INTO specialties (clinic_id, name)
  SELECT v_clinic_id, trim(p_specialty)
  WHERE NOT EXISTS (
    SELECT 1 FROM specialties WHERE clinic_id = v_clinic_id AND name = trim(p_specialty)
  );

  SELECT id INTO v_spec_id
  FROM specialties
  WHERE clinic_id = v_clinic_id AND name = trim(p_specialty)
  LIMIT 1;

  INSERT INTO locations (clinic_id, name)
  SELECT v_clinic_id, 'Consultorio principal'
  WHERE NOT EXISTS (SELECT 1 FROM locations WHERE clinic_id = v_clinic_id);

  SELECT id INTO v_loc_id FROM locations WHERE clinic_id = v_clinic_id LIMIT 1;

  INSERT INTO professionals (
    clinic_id,
    user_id,
    specialty_id,
    location_id,
    display_name,
    license_number,
    license_national,
    license_provincial,
    is_active
  )
  SELECT
    v_clinic_id,
    v_user_id,
    v_spec_id,
    v_loc_id,
    v_full_name,
    v_license_prov,
    trim(p_license_national),
    v_license_prov,
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM professionals WHERE clinic_id = v_clinic_id AND user_id = v_user_id
  )
  RETURNING id INTO v_pro_id;

  IF v_pro_id IS NULL THEN
    UPDATE professionals
    SET
      specialty_id = v_spec_id,
      display_name = v_full_name,
      license_number = v_license_prov,
      license_national = trim(p_license_national),
      license_provincial = v_license_prov
    WHERE clinic_id = v_clinic_id AND user_id = v_user_id
    RETURNING id INTO v_pro_id;
  END IF;

  UPDATE clinic_members
  SET professional_id = v_pro_id,
      updated_at = now()
  WHERE clinic_id = v_clinic_id
    AND user_id = v_user_id
    AND professional_id IS DISTINCT FROM v_pro_id;

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

  INSERT INTO clinic_feature_flags (clinic_id, flag_id, enabled)
  SELECT v_clinic_id, f.flag_id, true
  FROM (
    VALUES
      ('command_palette'),
      ('floating_actions'),
      ('clinical_timeline'),
      ('clinical_operations'),
      ('recordatorios'),
      ('consultation_assistant'),
      ('admin_ops_assistant'),
      ('patient_audit_tab'),
      ('public_booking_online')
  ) AS f(flag_id)
  ON CONFLICT (clinic_id, flag_id) DO NOTHING;

  RETURN v_clinic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION setup_user_clinic(
  text, text, text, text, text, text, text, text, text
) TO authenticated;
