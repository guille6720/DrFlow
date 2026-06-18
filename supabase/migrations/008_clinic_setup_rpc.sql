-- Fix: tras INSERT en clinics, el usuario aún no es miembro y RLS bloqueaba el SELECT (.single()).
-- RPC atómica para crear clínica + vincular al usuario autenticado.

DO $$ BEGIN
  CREATE POLICY clinics_select_setup ON clinics FOR SELECT
    USING (
      auth.uid() IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM clinic_members cm WHERE cm.clinic_id = clinics.id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
    UPDATE clinics
    SET name = p_name, email = v_email, phone = p_phone
    WHERE id = v_clinic_id;
  ELSE
    INSERT INTO clinics (name, slug, email, phone)
    VALUES (p_name, p_slug, v_email, p_phone)
    RETURNING id INTO v_clinic_id;
  END IF;

  INSERT INTO clinic_members (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_user_id, 'clinic_admin');

  RETURN v_clinic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION setup_user_clinic(text, text, text) TO authenticated;
