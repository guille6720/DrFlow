-- Refuerzo: borrado total del consultorio al eliminar cuenta propia.

CREATE OR REPLACE FUNCTION delete_own_account(p_confirm_phrase TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_clinic_id UUID;
  v_fallback UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida';
  END IF;

  IF trim(coalesce(p_confirm_phrase, '')) <> 'ELIMINAR MI CUENTA' THEN
    RAISE EXCEPTION 'Confirmación incorrecta';
  END IF;

  FOR v_clinic_id IN
    SELECT cm.clinic_id
    FROM clinic_members cm
    WHERE cm.user_id = v_user_id
      AND cm.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM clinic_members other
        WHERE other.clinic_id = cm.clinic_id
          AND other.user_id <> v_user_id
          AND other.is_active = true
      )
  LOOP
    DELETE FROM clinic_invitations WHERE clinic_id = v_clinic_id;
    DELETE FROM public_booking_links WHERE clinic_id = v_clinic_id;
    DELETE FROM clinics WHERE id = v_clinic_id;
  END LOOP;

  SELECT cm.user_id
  INTO v_fallback
  FROM clinic_members cm
  WHERE cm.user_id <> v_user_id
    AND cm.is_active = true
    AND cm.clinic_id IN (
      SELECT clinic_id FROM clinic_members WHERE user_id = v_user_id
    )
  ORDER BY
    CASE WHEN cm.role = 'clinic_admin' THEN 0 ELSE 1 END,
    cm.created_at
  LIMIT 1;

  PERFORM cleanup_user_profile_references(v_user_id, v_fallback);

  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION delete_own_account(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_own_account(TEXT) TO authenticated;
