-- Phase 9 (compliance): audit log security — authorship, timestamps, RLS hardening.
-- Complements 048/055 immutability triggers and 053 tenant-scoped INSERT.

-- ---------------------------------------------------------------------------
-- INSERT integrity: server-owned timestamps (no backdating via client INSERT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_audit_insert_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'audit_logs' THEN
    NEW.created_at := now();
  ELSIF TG_TABLE_NAME = 'clinical_record_audit' THEN
    NEW.changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_audit_insert_integrity IS
  'Forces audit row timestamps to now() on INSERT — clients cannot backdate audit events.';

DROP TRIGGER IF EXISTS audit_logs_insert_integrity ON audit_logs;
CREATE TRIGGER audit_logs_insert_integrity
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_insert_integrity();

DROP TRIGGER IF EXISTS clinical_record_audit_insert_integrity ON clinical_record_audit;
CREATE TRIGGER clinical_record_audit_insert_integrity
  BEFORE INSERT ON clinical_record_audit
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_insert_integrity();

-- ---------------------------------------------------------------------------
-- RLS: clinical_record_audit INSERT must match authenticated actor
-- (SECURITY DEFINER RPCs bypass RLS for server-side HC mutations)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS clinical_record_audit_insert ON clinical_record_audit;
CREATE POLICY clinical_record_audit_insert ON clinical_record_audit FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR (
      can_write_clinical(clinic_id)
      AND changed_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Defense in depth: no UPDATE/DELETE/TRUNCATE for app roles
-- (mutation blocked by triggers; explicit REVOKE closes policy gaps)
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_logs FROM anon;
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;

REVOKE UPDATE, DELETE ON clinical_record_audit FROM PUBLIC;
REVOKE UPDATE, DELETE ON clinical_record_audit FROM anon;
REVOKE UPDATE, DELETE ON clinical_record_audit FROM authenticated;

COMMENT ON TABLE audit_logs IS
  'Registro de auditoría inmutable — INSERT only; authorship via user_id=auth.uid(); timestamps server-owned.';

COMMENT ON TABLE clinical_record_audit IS
  'Auditoría de HC inmutable — INSERT only; authorship via changed_by=auth.uid(); timestamps server-owned.';
