-- Perfiles visibles para administradores del consultorio + nombre al aceptar invitación

DROP POLICY IF EXISTS profiles_select_clinic_managers ON profiles;
CREATE POLICY profiles_select_clinic_managers ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM clinic_members cm_viewer
      JOIN clinic_members cm_target ON cm_target.clinic_id = cm_viewer.clinic_id
      WHERE cm_viewer.user_id = auth.uid()
        AND cm_viewer.is_active = true
        AND cm_target.user_id = profiles.id
        AND can_manage_clinic(cm_viewer.clinic_id)
    )
  );

CREATE OR REPLACE FUNCTION public.accept_clinic_invitation_for_existing_user(
  p_clinic_id UUID,
  p_user_id UUID,
  p_email TEXT,
  p_role user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  IF NOT can_manage_clinic(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT full_name INTO v_full_name
  FROM clinic_invitations
  WHERE clinic_id = p_clinic_id
    AND lower(trim(email)) = lower(trim(p_email))
    AND status = 'pending'
  LIMIT 1;

  INSERT INTO clinic_members (clinic_id, user_id, role, is_active)
  VALUES (p_clinic_id, p_user_id, p_role, true)
  ON CONFLICT (clinic_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = true,
    updated_at = now();

  UPDATE clinic_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE clinic_id = p_clinic_id
    AND lower(email) = lower(trim(p_email));

  IF v_full_name IS NOT NULL AND trim(v_full_name) <> '' THEN
    UPDATE profiles
    SET full_name = COALESCE(NULLIF(trim(full_name), ''), v_full_name),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;
