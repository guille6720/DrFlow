-- 159: Secure user lifecycle (deactivate / reactivate / unlink / permanent delete).
-- Goals:
--   - Fix "Database error deleting user" by clearing ALL profile FKs before auth delete
--   - Preserve professional identity + clinical records + audit rows
--   - Free original emails for re-registration
--   - Protect last active clinic_admin
--   - Do NOT disable RLS; do NOT delete patient data

-- ---------------------------------------------------------------------------
-- 1) Profile lifecycle columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_email TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'disabled', 'deleted'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.account_status IS
  'active | disabled (login banned) | deleted (tombstone after permanent delete path)';
COMMENT ON COLUMN public.profiles.original_email IS
  'Email original conservado en auditoría al liberar el correo en Auth.';

-- ---------------------------------------------------------------------------
-- 2) Relax authorship FKs that block Auth delete (identity lives on professionals)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop NOT NULL on clinical authorship columns when present.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinical_records'
      AND column_name = 'created_by' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.clinical_records ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinical_record_audit'
      AND column_name = 'changed_by' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.clinical_record_audit ALTER COLUMN changed_by DROP NOT NULL;
  END IF;

  IF to_regclass('public.prescription_drafts') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'prescription_drafts'
         AND column_name = 'created_by' AND is_nullable = 'NO'
     ) THEN
    ALTER TABLE public.prescription_drafts ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  IF to_regclass('public.medical_orders') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'medical_orders'
         AND column_name = 'created_by' AND is_nullable = 'NO'
     ) THEN
    ALTER TABLE public.medical_orders ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  IF to_regclass('public.prescriptions') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'prescriptions'
         AND column_name = 'created_by' AND is_nullable = 'NO'
     ) THEN
    ALTER TABLE public.prescriptions ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  -- Ensure ON DELETE SET NULL for FKs pointing at profiles(id) when the column is nullable.
  FOR r IN
    SELECT
      c.conname,
      rel.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace AND n.nspname = 'public'
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN information_schema.columns cols
      ON cols.table_schema = 'public'
     AND cols.table_name = rel.relname
     AND cols.column_name = a.attname
     AND cols.is_nullable = 'YES'
    WHERE c.contype = 'f'
      AND ref.relname = 'profiles'
      AND c.confdeltype <> 'n' -- not already SET NULL (n)
      AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.conname);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
      r.table_name,
      r.conname,
      r.column_name
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Nullify every nullable FK column that references profiles(id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._nullify_all_nullable_profile_refs(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT
      rel.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace AND n.nspname = 'public'
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    JOIN information_schema.columns cols
      ON cols.table_schema = 'public'
     AND cols.table_name = rel.relname
     AND cols.column_name = a.attname
     AND cols.is_nullable = 'YES'
    WHERE c.contype = 'f'
      AND ref.relname = 'profiles'
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET %I = NULL WHERE %I = $1',
      r.table_name,
      r.column_name,
      r.column_name
    )
    USING p_user_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._nullify_all_nullable_profile_refs(UUID) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 4) Audit-safe maintain (never delete clinical audit rows)
-- ---------------------------------------------------------------------------
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
    UPDATE audit_logs SET user_id = NULL WHERE user_id = p_user_id;
    ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutable;
  END IF;

  IF to_regclass('public.clinical_record_audit') IS NOT NULL
     AND EXISTS (SELECT 1 FROM clinical_record_audit WHERE changed_by = p_user_id) THEN
    ALTER TABLE clinical_record_audit DISABLE TRIGGER clinical_record_audit_immutable;
    -- Preserve the audit row; identity remains via clinical_records.professional_id.
    UPDATE clinical_record_audit SET changed_by = NULL WHERE changed_by = p_user_id;
    ALTER TABLE clinical_record_audit ENABLE TRIGGER clinical_record_audit_immutable;
  END IF;

  -- p_fallback intentionally unused: do not rewrite clinical authorship to another person.
END;
$$;

REVOKE ALL ON FUNCTION public._maintain_audit_refs_for_user_deletion(UUID, UUID) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5) Cleanup before auth.users DELETE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_user_profile_references(
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
      SELECT cm.user_id
      FROM clinic_members cm
      WHERE cm.user_id IS DISTINCT FROM p_user_id
        AND cm.is_active = true
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT id FROM profiles
      WHERE id IS DISTINCT FROM p_user_id
        AND COALESCE(account_status, 'active') <> 'deleted'
      ORDER BY created_at
      LIMIT 1
    )
  );

  -- Explicit known refs (safe even if dynamic loop misses edge cases).
  PERFORM public._nullify_profile_ref('appointments', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('appointments', 'cancelled_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_attachments', 'uploaded_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinical_records', 'created_by', p_user_id);
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
  PERFORM public._nullify_profile_ref('appointment_status_history', 'changed_by', p_user_id);
  PERFORM public._nullify_profile_ref('waiting_list', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_jobs', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_plugins', 'updated_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_feature_flags', 'updated_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_api_keys', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('os_liquidacion_batches', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('prescription_events', 'actor_id', p_user_id);
  PERFORM public._nullify_profile_ref('prescriptions', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('prescription_drafts', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('medical_orders', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('data_import_sessions', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('data_export_sessions', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('privacy_rights_requests', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('privacy_rights_requests', 'resolved_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_consents', 'withdrawn_by', p_user_id);
  PERFORM public._nullify_profile_ref('patients', 'deactivated_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinical_records', 'archived_by', p_user_id);
  PERFORM public._nullify_profile_ref('informed_consents', 'recorded_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_entitlement_overrides', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinic_upgrade_recommendations', 'reviewed_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinical_record_diagnoses', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('clinical_record_treatments', 'created_by', p_user_id);

  -- Catch-all for any other nullable profile FKs.
  PERFORM public._nullify_all_nullable_profile_refs(p_user_id);

  -- Invitations require an inviter — reassign only this non-clinical ownership field.
  IF v_fallback IS NOT NULL THEN
    PERFORM public._reassign_profile_ref('clinic_invitations', 'invited_by', p_user_id, v_fallback);
  ELSIF to_regclass('public.clinic_invitations') IS NOT NULL THEN
    DELETE FROM clinic_invitations WHERE invited_by = p_user_id AND status = 'pending';
    IF EXISTS (SELECT 1 FROM clinic_invitations WHERE invited_by = p_user_id) THEN
      RAISE EXCEPTION 'No hay otro usuario para reasignar invitaciones históricas';
    END IF;
  END IF;

  PERFORM public._maintain_audit_refs_for_user_deletion(p_user_id, v_fallback);

  -- Preserve professional clinical identity; only unlink login.
  IF to_regclass('public.professionals') IS NOT NULL THEN
    UPDATE professionals
    SET user_id = NULL, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.clinic_members') IS NOT NULL THEN
    DELETE FROM clinic_members WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.user_device_sessions') IS NOT NULL THEN
    UPDATE user_device_sessions
    SET revoked_at = COALESCE(revoked_at, now())
    WHERE user_id = p_user_id AND revoked_at IS NULL;
  END IF;

  IF to_regclass('public.user_ai_connections') IS NOT NULL THEN
    DELETE FROM user_ai_connections WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.clinical_favorites') IS NOT NULL THEN
    DELETE FROM clinical_favorites WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.clinical_recent_usage') IS NOT NULL THEN
    DELETE FROM clinical_recent_usage WHERE user_id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_user_profile_references(UUID, UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_auth_user_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.cleanup_user_profile_references(OLD.id, NULL);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_before_delete ON auth.users;
CREATE TRIGGER on_auth_user_before_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_before_delete();

-- ---------------------------------------------------------------------------
-- 6) Last-admin guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_not_last_active_clinic_admin(
  p_clinic_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_other_admins INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM clinic_members
    WHERE clinic_id = p_clinic_id
      AND user_id = p_user_id
      AND role = 'clinic_admin'
      AND is_active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INT INTO v_other_admins
  FROM clinic_members
  WHERE clinic_id = p_clinic_id
    AND user_id IS DISTINCT FROM p_user_id
    AND role = 'clinic_admin'
    AND is_active = true;

  IF v_other_admins = 0 THEN
    RAISE EXCEPTION 'LAST_CLINIC_ADMIN'
      USING HINT = 'Designá otro administrador activo antes de dar de baja a este usuario.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_not_last_active_clinic_admin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_not_last_active_clinic_admin(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Lifecycle RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_can_manage_clinic_user(
  p_clinic_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida';
  END IF;

  IF p_clinic_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id y user_id requeridos';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No podés operar sobre tu propia cuenta con esta acción';
  END IF;

  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) = 'clinic_admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores o Superadmin pueden gestionar usuarios';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM clinic_members
    WHERE clinic_id = p_clinic_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'El usuario no pertenece a esta clínica';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_can_manage_clinic_user(UUID, UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_deactivate_clinic_member(
  p_clinic_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_can_manage_clinic_user(p_clinic_id, p_user_id);
  PERFORM public.assert_not_last_active_clinic_admin(p_clinic_id, p_user_id);

  UPDATE clinic_members
  SET is_active = false, updated_at = now()
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id;

  UPDATE profiles
  SET
    account_status = 'disabled',
    disabled_at = now(),
    disabled_by = auth.uid(),
    updated_at = now()
  WHERE id = p_user_id;

  IF to_regclass('public.user_device_sessions') IS NOT NULL THEN
    UPDATE user_device_sessions
    SET revoked_at = COALESCE(revoked_at, now())
    WHERE user_id = p_user_id AND revoked_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'deactivate', 'user_id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reactivate_clinic_member(
  p_clinic_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_can_manage_clinic_user(p_clinic_id, p_user_id);

  UPDATE clinic_members
  SET is_active = true, updated_at = now()
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id;

  UPDATE profiles
  SET
    account_status = 'active',
    disabled_at = NULL,
    disabled_by = NULL,
    updated_at = now()
  WHERE id = p_user_id
    AND COALESCE(account_status, 'active') <> 'deleted';

  RETURN jsonb_build_object('ok', true, 'action', 'reactivate', 'user_id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unlink_clinic_member(
  p_clinic_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INT;
BEGIN
  PERFORM public.admin_can_manage_clinic_user(p_clinic_id, p_user_id);
  PERFORM public.assert_not_last_active_clinic_admin(p_clinic_id, p_user_id);

  -- Unlink professional login for this clinic only (global professional row kept).
  IF to_regclass('public.professionals') IS NOT NULL THEN
    UPDATE professionals
    SET user_id = NULL, updated_at = now()
    WHERE user_id = p_user_id
      AND clinic_id = p_clinic_id;
  END IF;

  DELETE FROM clinic_members
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id;

  SELECT COUNT(*)::INT INTO v_remaining
  FROM clinic_members
  WHERE user_id = p_user_id AND is_active = true;

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'unlink',
    'user_id', p_user_id,
    'remaining_active_memberships', v_remaining
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_permanently_delete_clinic_user(
  p_clinic_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
BEGIN
  PERFORM public.admin_can_manage_clinic_user(p_clinic_id, p_user_id);
  PERFORM public.assert_not_last_active_clinic_admin(p_clinic_id, p_user_id);

  SELECT email, full_name INTO v_email, v_name
  FROM profiles WHERE id = p_user_id;

  -- Snapshot before cleanup removes membership.
  UPDATE profiles
  SET
    original_email = COALESCE(original_email, email),
    account_status = 'deleted',
    deleted_at = now(),
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.cleanup_user_profile_references(p_user_id, auth.uid());

  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'permanent_delete',
    'user_id', p_user_id,
    'email', v_email,
    'full_name', v_name
  );
END;
$$;

-- Keep legacy RPC as thin wrapper (same permanent delete semantics).
CREATE OR REPLACE FUNCTION public.remove_clinic_member_user(
  p_clinic_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.admin_permanently_delete_clinic_user(p_clinic_id, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_deactivate_clinic_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reactivate_clinic_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unlink_clinic_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_permanently_delete_clinic_user(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_clinic_member_user(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_deactivate_clinic_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_clinic_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_clinic_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_permanently_delete_clinic_user(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_clinic_member_user(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
