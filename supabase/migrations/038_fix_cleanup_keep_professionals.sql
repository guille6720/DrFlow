-- No borrar filas de professionals al eliminar un usuario Auth.
-- professionals.user_id ya tiene ON DELETE SET NULL hacia profiles.
-- Borrar professionals rompía FKs (public_booking_links, clinical_records, etc.).

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
      SELECT id
      FROM profiles
      WHERE id IS DISTINCT FROM p_user_id
      ORDER BY created_at
      LIMIT 1
    )
  );

  IF v_fallback IS NULL THEN
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

  PERFORM public._reassign_profile_ref('clinical_records', 'created_by', p_user_id, v_fallback);
  PERFORM public._reassign_profile_ref('clinical_record_audit', 'changed_by', p_user_id, v_fallback);
  PERFORM public._reassign_profile_ref('prescription_drafts', 'created_by', p_user_id, v_fallback);
  PERFORM public._reassign_profile_ref('medical_orders', 'created_by', p_user_id, v_fallback);
  PERFORM public._reassign_profile_ref('clinic_invitations', 'invited_by', p_user_id, v_fallback);

  -- Desvincular profesional del usuario (el registro clínico histórico se conserva).
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

REVOKE ALL ON FUNCTION cleanup_user_profile_references(UUID, UUID) FROM PUBLIC;
