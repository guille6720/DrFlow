-- Phase 12: immutable audit trail — patient scope, old/new values, clinical read access.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS new_values JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_logs_patient
  ON audit_logs(clinic_id, patient_id, created_at DESC)
  WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_record_audit_clinic_record
  ON clinical_record_audit(clinic_id, clinical_record_id, changed_at DESC);

-- Backfill patient_id only when the patient row still exists
UPDATE audit_logs al
SET patient_id = al.entity_id
FROM patients p
WHERE al.patient_id IS NULL
  AND al.entity_type = 'patient'
  AND al.entity_id IS NOT NULL
  AND al.entity_id = p.id;

-- Clinical staff with HC access can read clinic audit (patient workspace tab)
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (
    is_superadmin()
    OR (
      clinic_id IS NOT NULL
      AND user_role_in_clinic(clinic_id) = 'clinic_admin'
    )
    OR (
      clinic_id IS NOT NULL
      AND can_view_clinical(clinic_id)
    )
  );

-- Immutable audit tables — no UPDATE/DELETE even for superadmin (defense in depth)
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

COMMENT ON COLUMN audit_logs.patient_id IS 'Paciente relacionado — acelera timeline de auditoría en workspace.';
COMMENT ON COLUMN audit_logs.old_values IS 'Estado anterior (PHI mínimo necesario para trazabilidad).';
COMMENT ON COLUMN audit_logs.new_values IS 'Estado posterior.';
