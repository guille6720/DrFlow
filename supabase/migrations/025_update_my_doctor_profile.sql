-- Permite al médico titular editar sus datos desde el dashboard (header).

CREATE OR REPLACE FUNCTION update_my_doctor_profile(
  p_clinic_id uuid,
  p_doctor_first_name text,
  p_doctor_last_name text,
  p_document_number text,
  p_phone text,
  p_specialty text,
  p_license_national text,
  p_license_provincial text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_full_name text;
  v_license_prov text;
  v_spec_id uuid;
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

  IF NOT EXISTS (
    SELECT 1 FROM clinic_members
    WHERE clinic_id = p_clinic_id AND user_id = v_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'NOT_MEMBER';
  END IF;

  v_full_name := trim(p_doctor_first_name) || ' ' || trim(p_doctor_last_name);
  v_license_prov := COALESCE(NULLIF(trim(p_license_provincial), ''), trim(p_license_national));

  UPDATE profiles
  SET
    full_name = v_full_name,
    phone = trim(p_phone),
    document_number = trim(p_document_number)
  WHERE id = v_user_id;

  UPDATE clinics
  SET phone = trim(p_phone)
  WHERE id = p_clinic_id;

  INSERT INTO specialties (clinic_id, name)
  SELECT p_clinic_id, trim(p_specialty)
  WHERE NOT EXISTS (
    SELECT 1 FROM specialties WHERE clinic_id = p_clinic_id AND name = trim(p_specialty)
  );

  SELECT id INTO v_spec_id
  FROM specialties
  WHERE clinic_id = p_clinic_id AND name = trim(p_specialty)
  LIMIT 1;

  UPDATE professionals
  SET
    display_name = v_full_name,
    license_number = v_license_prov,
    license_national = trim(p_license_national),
    license_provincial = v_license_prov,
    specialty_id = v_spec_id
  WHERE clinic_id = p_clinic_id AND user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_my_doctor_profile(
  uuid, text, text, text, text, text, text, text
) TO authenticated;
