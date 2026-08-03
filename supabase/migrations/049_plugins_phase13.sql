-- Phase 13: plugin platform — per-clinic enablement without redeploy.

CREATE TABLE IF NOT EXISTS clinic_plugins (
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id),
  PRIMARY KEY (clinic_id, plugin_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_plugins_clinic
  ON clinic_plugins(clinic_id);

ALTER TABLE clinic_plugins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_plugins_select ON clinic_plugins;
CREATE POLICY clinic_plugins_select ON clinic_plugins FOR SELECT
  USING (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
  );

DROP POLICY IF EXISTS clinic_plugins_manage ON clinic_plugins;
CREATE POLICY clinic_plugins_manage ON clinic_plugins FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

CREATE POLICY clinic_plugins_update ON clinic_plugins FOR UPDATE
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  )
  WITH CHECK (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

-- Seed defaults for existing clinics (backward compatible — optional plugins on)
INSERT INTO clinic_plugins (clinic_id, plugin_id, enabled)
SELECT c.id, p.plugin_id, p.enabled
FROM clinics c
CROSS JOIN (
  VALUES
    ('pami', true),
    ('ia', true),
    ('pharmacology', true),
    ('portal', true),
    ('voice', true),
    ('telemedicina', false),
    ('facturacion', false),
    ('laboratorio', false),
    ('imagenes', false),
    ('odontologia', false),
    ('veterinaria', false)
) AS p(plugin_id, enabled)
ON CONFLICT (clinic_id, plugin_id) DO NOTHING;

COMMENT ON TABLE clinic_plugins IS 'Plugin toggles per clinic — Phase 13 platform.';
