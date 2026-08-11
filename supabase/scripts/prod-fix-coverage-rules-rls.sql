-- Production fix: align coverage_rules RLS with manageSettings (migration 097).
-- Safe to re-run.

DROP POLICY IF EXISTS coverage_rules_insert ON coverage_rules;
CREATE POLICY coverage_rules_insert ON coverage_rules FOR INSERT
  WITH CHECK (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS coverage_rules_update ON coverage_rules;
CREATE POLICY coverage_rules_update ON coverage_rules FOR UPDATE
  USING (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS coverage_rules_delete ON coverage_rules;
CREATE POLICY coverage_rules_delete ON coverage_rules FOR DELETE
  USING (can_manage_clinic(clinic_id));
