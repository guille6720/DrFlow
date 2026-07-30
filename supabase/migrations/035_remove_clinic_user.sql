-- Eliminar miembro del equipo y cuenta Auth sin violar FKs hacia profiles.
-- Supabase Dashboard falla con "Failed to delete selected users: {}" cuando hay
-- registros clínicos/caja que referencian al usuario.

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

  -- Nullable: SET NULL
  UPDATE appointments SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE appointments SET cancelled_by = NULL WHERE cancelled_by = p_user_id;
  UPDATE patient_attachments SET uploaded_by = NULL WHERE uploaded_by = p_user_id;
  UPDATE clinical_records SET updated_by = NULL WHERE updated_by = p_user_id;
  UPDATE clinical_record_attachments SET uploaded_by = NULL WHERE uploaded_by = p_user_id;
  UPDATE schedule_blocks SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE telemedicine_sessions SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE audit_logs SET user_id = NULL WHERE user_id = p_user_id;

  UPDATE cash_charges SET created_by = NULL, updated_by = NULL
  WHERE created_by = p_user_id OR updated_by = p_user_id;
  UPDATE patient_ledger_entries SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE cash_invoices SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE cash_daily_closures SET closed_by = NULL WHERE closed_by = p_user_id;
  UPDATE patient_admin_documents SET uploaded_by = NULL WHERE uploaded_by = p_user_id;

  -- NOT NULL: reasignar al admin de respaldo
  UPDATE clinical_records SET created_by = v_fallback WHERE created_by = p_user_id;
  UPDATE clinical_record_audit SET changed_by = v_fallback WHERE changed_by = p_user_id;
  UPDATE prescription_drafts SET created_by = v_fallback WHERE created_by = p_user_id;
  UPDATE medical_orders SET created_by = v_fallback WHERE created_by = p_user_id;
  UPDATE clinic_invitations SET invited_by = v_fallback WHERE invited_by = p_user_id;

  -- Filas del miembro (professionals.user_id tiene ON DELETE SET NULL al borrar profile)
  DELETE FROM clinic_members WHERE user_id = p_user_id;
  DELETE FROM professionals WHERE user_id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;
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
END;
$$;

REVOKE ALL ON FUNCTION cleanup_user_profile_references(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION remove_clinic_member_user(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION remove_clinic_member_user(UUID, UUID) TO authenticated;
