-- Phase 18: immutable audit logging — module, what, truncate protection, cleanup fix.

-- ---------------------------------------------------------------------------
-- audit_logs: module + human-readable action label
-- ---------------------------------------------------------------------------
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS what TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_module_created
  ON audit_logs (clinic_id, module, created_at DESC)
  WHERE clinic_id IS NOT NULL;

COMMENT ON COLUMN audit_logs.module IS 'Módulo funcional: clinical, patients, appointments, prescriptions, cash, etc.';
COMMENT ON COLUMN audit_logs.what IS 'Descripción legible de la acción auditada (qué ocurrió).';
COMMENT ON COLUMN audit_logs.user_id IS 'Quién — usuario que realizó la acción.';
COMMENT ON COLUMN audit_logs.created_at IS 'Cuándo — timestamp inmutable del evento.';
COMMENT ON COLUMN audit_logs.clinic_id IS 'Organización — consultorio (tenant).';
COMMENT ON COLUMN audit_logs.patient_id IS 'Paciente relacionado, cuando aplica.';
COMMENT ON COLUMN audit_logs.old_values IS 'Valor anterior (JSONB, sanitizado en app).';
COMMENT ON COLUMN audit_logs.new_values IS 'Valor nuevo (JSONB, sanitizado en app).';
COMMENT ON TABLE audit_logs IS 'Registro de auditoría inmutable — INSERT only; sin UPDATE/DELETE/TRUNCATE.';

-- ---------------------------------------------------------------------------
-- clinical_record_audit: align with audit_logs schema
-- ---------------------------------------------------------------------------
ALTER TABLE clinical_record_audit
  ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'clinical',
  ADD COLUMN IF NOT EXISTS what TEXT,
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_record_audit_patient
  ON clinical_record_audit (clinic_id, patient_id, changed_at DESC)
  WHERE patient_id IS NOT NULL;

-- 048 may already have immutability triggers — drop for one-time backfill only.
DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
DROP TRIGGER IF EXISTS clinical_record_audit_immutable ON clinical_record_audit;

UPDATE clinical_record_audit cra
SET patient_id = cr.patient_id
FROM clinical_records cr
WHERE cra.patient_id IS NULL
  AND cra.clinical_record_id = cr.id;

-- ---------------------------------------------------------------------------
-- Immutability (re-assert) + block TRUNCATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoría no pueden modificarse ni eliminarse';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER IF EXISTS clinical_record_audit_immutable ON clinical_record_audit;
CREATE TRIGGER clinical_record_audit_immutable
  BEFORE UPDATE OR DELETE ON clinical_record_audit
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

REVOKE TRUNCATE ON audit_logs FROM PUBLIC;
REVOKE TRUNCATE ON audit_logs FROM anon;
REVOKE TRUNCATE ON audit_logs FROM authenticated;
REVOKE TRUNCATE ON clinical_record_audit FROM PUBLIC;
REVOKE TRUNCATE ON clinical_record_audit FROM anon;
REVOKE TRUNCATE ON clinical_record_audit FROM authenticated;

-- ---------------------------------------------------------------------------
-- User cleanup: never mutate immutable audit tables
-- ---------------------------------------------------------------------------
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

  -- audit_logs / clinical_record_audit are immutable — excluded from reassign gate
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
  -- audit_logs: immutable — user_id preserved for traceability
  PERFORM public._nullify_profile_ref('cash_charges', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_charges', 'updated_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_ledger_entries', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_invoices', 'created_by', p_user_id);
  PERFORM public._nullify_profile_ref('cash_daily_closures', 'closed_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_admin_documents', 'uploaded_by', p_user_id);
  PERFORM public._nullify_profile_ref('patient_app_share_log', 'shared_by', p_user_id);

  IF v_fallback IS NOT NULL THEN
    PERFORM public._reassign_profile_ref('clinical_records', 'created_by', p_user_id, v_fallback);
    -- clinical_record_audit: immutable — changed_by preserved
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
