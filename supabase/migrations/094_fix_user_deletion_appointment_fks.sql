-- 094: User deletion blocked by appointment module FKs (084+) not handled in cleanup.

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
  PERFORM public._nullify_profile_ref('cash_charges', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_charges', 'updated_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_ledger_entries', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_invoices', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_daily_closures', 'closed_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_admin_documents', 'uploaded_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_app_share_log', 'shared_by', p_user_id);
  -- Appointment module (084+)
  PERFORM public._nullify_profile_ref('appointment_status_history', 'changed_by', p_user_id);
  PERFORM public._nullify_profile_ref('waiting_list', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_jobs', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_plugins', 'updated_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_feature_flags', 'updated_by', p_user_id);

  IF v_fallback IS NOT NULL THEN
    PERFORM public._reassign_profile_ref('clinical_records', 'created_by', p_user_id, v_fallback);
    PERFORM public._reassign_profile_ref('prescription_drafts', 'created_by', p_user_id, v_fallback);
    PERFORM public._reassign_profile_ref('medical_orders', 'created_by', p_user_id, v_fallback);
    PERFORM public._reassign_profile_ref('clinic_invitations', 'invited_by', p_user_id, v_fallback);
  END IF;

  PERFORM public._maintain_audit_refs_for_user_deletion(p_user_id, v_fallback);

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

CREATE OR REPLACE FUNCTION remove_clinic_member_user(
  p_clinic_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_clinic_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id y user_id requeridos';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No podés eliminarte a vos mismo';
  END IF;

  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) = 'clinic_admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden eliminar usuarios';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM clinic_members cm
    WHERE cm.clinic_id = p_clinic_id
      AND cm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'El usuario no pertenece a esta clínica';
  END IF;

  PERFORM cleanup_user_profile_references(p_user_id, auth.uid());

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION remove_clinic_member_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_clinic_member_user(UUID, UUID) TO authenticated;
