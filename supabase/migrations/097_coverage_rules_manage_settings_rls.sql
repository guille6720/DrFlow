-- Tighten coverage_rules writes to clinic settings admins (manageSettings), not all clinical writers.

DROP POLICY IF EXISTS coverage_rules_insert ON coverage_rules;
CREATE POLICY coverage_rules_insert ON coverage_rules FOR INSERT
  WITH CHECK (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS coverage_rules_update ON coverage_rules;
CREATE POLICY coverage_rules_update ON coverage_rules FOR UPDATE
  USING (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS coverage_rules_delete ON coverage_rules;
CREATE POLICY coverage_rules_delete ON coverage_rules FOR DELETE
  USING (can_manage_clinic(clinic_id));

COMMENT ON TABLE coverage_rules IS
  'Reglas configurables por cobertura — escritura solo clinic_admin/secretary (can_manage_clinic)';
