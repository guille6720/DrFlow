-- Fix clinical_diagnoses catalog SELECT for post-hardening EXECUTE grants.
-- anon cannot EXECUTE is_superadmin(); evaluating it inside a PUBLIC RLS policy
-- raises "permission denied for function is_superadmin" instead of returning no rows.
-- Scope policy to authenticated staff only (catalog is not public).

DROP POLICY IF EXISTS clinical_diagnoses_select ON clinical_diagnoses;
CREATE POLICY clinical_diagnoses_select ON clinical_diagnoses
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
    )
  );
