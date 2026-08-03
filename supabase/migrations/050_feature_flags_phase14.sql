-- Phase 14: granular feature flags per clinic (runtime, no redeploy).

CREATE TABLE IF NOT EXISTS clinic_feature_flags (
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  flag_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id),
  PRIMARY KEY (clinic_id, flag_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_feature_flags_clinic
  ON clinic_feature_flags(clinic_id);

ALTER TABLE clinic_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_feature_flags_select ON clinic_feature_flags;
CREATE POLICY clinic_feature_flags_select ON clinic_feature_flags FOR SELECT
  USING (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
  );

DROP POLICY IF EXISTS clinic_feature_flags_insert ON clinic_feature_flags;
CREATE POLICY clinic_feature_flags_insert ON clinic_feature_flags FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

CREATE POLICY clinic_feature_flags_update ON clinic_feature_flags FOR UPDATE
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  )
  WITH CHECK (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

INSERT INTO clinic_feature_flags (clinic_id, flag_id, enabled)
SELECT c.id, f.flag_id, true
FROM clinics c
CROSS JOIN (
  VALUES
    ('command_palette'),
    ('floating_actions'),
    ('clinical_timeline'),
    ('clinical_operations'),
    ('recordatorios'),
    ('consultation_assistant'),
    ('patient_audit_tab'),
    ('public_booking_online')
) AS f(flag_id)
ON CONFLICT (clinic_id, flag_id) DO NOTHING;

COMMENT ON TABLE clinic_feature_flags IS 'Feature flags granulares por clínica — Phase 14.';
