-- Ejecutar en Supabase SQL Editor (PRODUCTION) si eliminar cuenta falla por clinical_record_audit FK.
-- Contenido idéntico a supabase/migrations/093_fix_delete_account_audit_fks.sql

-- 093: Account deletion blocked by immutable audit FKs (055 preserved rows but blocked profile delete).

CREATE OR REPLACE FUNCTION public._maintain_audit_refs_for_user_deletion(
  p_user_id UUID,
  p_fallback UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL
     AND EXISTS (SELECT 1 FROM audit_logs WHERE user_id = p_user_id) THEN
    ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutable;

    IF p_fallback IS NOT NULL THEN
      UPDATE audit_logs SET user_id = p_fallback WHERE user_id = p_user_id;
    ELSE
      UPDATE audit_logs SET user_id = NULL WHERE user_id = p_user_id;
    END IF;

    ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutable;
  END IF;

  IF to_regclass('public.clinical_record_audit') IS NOT NULL
     AND EXISTS (SELECT 1 FROM clinical_record_audit WHERE changed_by = p_user_id) THEN
    ALTER TABLE clinical_record_audit DISABLE TRIGGER clinical_record_audit_immutable;

    IF p_fallback IS NOT NULL THEN
      UPDATE clinical_record_audit
      SET changed_by = p_fallback
      WHERE changed_by = p_user_id;
    ELSE
      DELETE FROM clinical_record_audit WHERE changed_by = p_user_id;
    END IF;

    ALTER TABLE clinical_record_audit ENABLE TRIGGER clinical_record_audit_immutable;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._maintain_audit_refs_for_user_deletion(UUID, UUID) FROM PUBLIC;

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
