-- Autogestión: el usuario autenticado puede eliminar su propia cuenta Auth.
-- Si es el único miembro activo de una clínica, borra el consultorio completo (CASCADE).

CREATE OR REPLACE FUNCTION cleanup_user_profile_references(
  p_user_id UUID,
  p_reassign_to UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_fallback UUID;
  v_needs_reassign BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id requerido';
  END IF;

  v_fallback := COALESCE(
    p_reassign_to,
    (
      SELECT cm.user_id
      FROM clinic_members cm
      WHERE cm.user_id IS DISTINCT FROM p_user_id
        AND cm.role = 'clinic_admin'
        AND cm.is_active = true
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT cm.user_id
      FROM clinic_members cm
      WHERE cm.user_id IS DISTINCT FROM p_user_id
        AND cm.is_active = true
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT id
      FROM profiles
      WHERE id IS DISTINCT FROM p_user_id
      ORDER BY created_at
      LIMIT 1
    )
  );

  SELECT EXISTS (
    SELECT 1 FROM clinical_records WHERE created_by = p_user_id
    UNION ALL
    SELECT 1 FROM clinical_record_audit WHERE changed_by = p_user_id
    UNION ALL
    SELECT 1 FROM prescription_drafts WHERE created_by = p_user_id
    UNION ALL
    SELECT 1 FROM medical_orders WHERE created_by = p_user_id
    UNION ALL
    SELECT 1 FROM clinic_invitations WHERE invited_by = p_user_id
  )
  INTO v_needs_reassign;

  IF v_needs_reassign AND v_fallback IS NULL THEN
    RAISE EXCEPTION 'No hay otro usuario para reasignar registros históricos';
  END IF;

  PERFORM public._nullify_profile_ref('appointments', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('appointments', 'cancelled_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_attachments', 'uploaded_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinical_records', 'updated_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinical_record_attachments', 'uploaded_by', p_user_id);
  PERFORM public._nullify_profile_ref('schedule_blocks', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('telemedicine_sessions', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('audit_logs', 'user_id', p_user_id);
  PERFORM public._nullify_profile_ref('cash_charges', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_charges', 'updated_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_ledger_entries', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_invoices', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_daily_closures', 'closed_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_admin_documents', 'uploaded_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_app_share_log', 'shared_by', p_user_id);

  IF v_fallback IS NOT NULL THEN
    PERFORM public._reassign_profile_ref('clinical_records', 'created_by', p_user_id, v_fallback);
    PERFORM public._reassign_profile_ref('clinical_record_audit', 'changed_by', p_user_id, v_fallback);
    PERFORM public._reassign_profile_ref('prescription_drafts', 'created_by', p_user_id, v_fallback);
    PERFORM public._reassign_profile_ref('medical_orders', 'created_by', p_user_id, v_fallback);
    PERFORM public._reassign_profile_ref('clinic_invitations', 'invited_by', p_user_id, v_fallback);
  END IF;

  IF to_regclass('public.professionals') IS NOT NULL THEN
    UPDATE professionals
    SET user_id = NULL, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.clinic_members') IS NOT NULL THEN
    DELETE FROM clinic_members WHERE user_id = p_user_id;
  END IF;
END;
$$;

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

  -- Consultorios donde es el único miembro activo: borrado total.
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
