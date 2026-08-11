-- Prod fix: prescription engine schema (migration 096)
-- Run in Supabase SQL Editor on production if deploy 2f4bc47+ fails on issue/save prescriptions.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ─── prescription_drafts: coverage + idempotency ───
ALTER TABLE prescription_drafts
  ADD COLUMN IF NOT EXISTS coverage_kind TEXT,
  ADD COLUMN IF NOT EXISTS insurance_number TEXT,
  ADD COLUMN IF NOT EXISTS insurance_plan TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE prescription_drafts
  DROP CONSTRAINT IF EXISTS prescription_drafts_coverage_kind_check;

ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_coverage_kind_check
  CHECK (
    coverage_kind IS NULL
    OR coverage_kind IN ('PAMI', 'OBRAS_SOCIALES', 'PREPAGAS', 'PARTICULAR')
  );

COMMENT ON COLUMN prescription_drafts.coverage_kind IS
  'Motor de recetas: PAMI | OBRAS_SOCIALES | PREPAGAS | PARTICULAR';
COMMENT ON COLUMN prescription_drafts.insurance_number IS
  'N° afiliado o beneficio al momento de emitir';
COMMENT ON COLUMN prescription_drafts.insurance_plan IS
  'Plan de cobertura al momento de emitir';
COMMENT ON COLUMN prescription_drafts.idempotency_key IS
  'Clave idempotente por clínica para evitar emisión duplicada';
COMMENT ON COLUMN prescription_drafts.dispensed_at IS
  'Marca de tiempo de dispensación en farmacia (estado DISPENSED)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_prescription_drafts_clinic_idempotency
  ON prescription_drafts (clinic_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescription_drafts_coverage_kind
  ON prescription_drafts (clinic_id, coverage_kind)
  WHERE coverage_kind IS NOT NULL;

-- ─── prescription_events (trazabilidad) ───
CREATE TABLE IF NOT EXISTS prescription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescription_drafts(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prescription_events_event_type_check
    CHECK (
      event_type IN (
        'created',
        'updated',
        'validated',
        'issued',
        'voided',
        'dispensed',
        'template_applied'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_prescription_events_prescription
  ON prescription_events (prescription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescription_events_clinic
  ON prescription_events (clinic_id, created_at DESC);

COMMENT ON TABLE prescription_events IS
  'Trazabilidad del motor de recetas (append-only)';

-- ─── prescription_templates ───
CREATE TABLE IF NOT EXISTS prescription_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  coverage_kind TEXT,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  diagnosis_cie10 TEXT,
  diagnosis_text TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prescription_templates_coverage_kind_check
    CHECK (
      coverage_kind IS NULL
      OR coverage_kind IN ('PAMI', 'OBRAS_SOCIALES', 'PREPAGAS', 'PARTICULAR')
    )
);

CREATE INDEX IF NOT EXISTS idx_prescription_templates_clinic
  ON prescription_templates (clinic_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescription_templates_professional
  ON prescription_templates (clinic_id, professional_id)
  WHERE professional_id IS NOT NULL;

COMMENT ON TABLE prescription_templates IS
  'Plantillas de medicamentos/indicaciones — requieren validación médica al emitir';

-- ─── coverage_rules (config por clínica) ───
CREATE TABLE IF NOT EXISTS coverage_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  coverage_kind TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coverage_rules_coverage_kind_check
    CHECK (coverage_kind IN ('PAMI', 'OBRAS_SOCIALES', 'PREPAGAS', 'PARTICULAR')),
  UNIQUE (clinic_id, coverage_kind)
);

COMMENT ON TABLE coverage_rules IS
  'Reglas configurables por cobertura — defaults en app, overrides por clínica';

-- ─── RLS ───
ALTER TABLE prescription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prescription_events_select ON prescription_events;
CREATE POLICY prescription_events_select ON prescription_events FOR SELECT
  USING (can_view_clinical(clinic_id));

DROP POLICY IF EXISTS prescription_events_insert ON prescription_events;
CREATE POLICY prescription_events_insert ON prescription_events FOR INSERT
  WITH CHECK (can_write_clinical(clinic_id));

DROP POLICY IF EXISTS prescription_templates_select ON prescription_templates;
CREATE POLICY prescription_templates_select ON prescription_templates FOR SELECT
  USING (can_view_clinical(clinic_id));

DROP POLICY IF EXISTS prescription_templates_insert ON prescription_templates;
CREATE POLICY prescription_templates_insert ON prescription_templates FOR INSERT
  WITH CHECK (can_write_clinical(clinic_id));

DROP POLICY IF EXISTS prescription_templates_update ON prescription_templates;
CREATE POLICY prescription_templates_update ON prescription_templates FOR UPDATE
  USING (can_write_clinical(clinic_id));

DROP POLICY IF EXISTS prescription_templates_delete ON prescription_templates;
CREATE POLICY prescription_templates_delete ON prescription_templates FOR DELETE
  USING (can_write_clinical(clinic_id));

DROP POLICY IF EXISTS coverage_rules_select ON coverage_rules;
CREATE POLICY coverage_rules_select ON coverage_rules FOR SELECT
  USING (can_view_clinical(clinic_id));

DROP POLICY IF EXISTS coverage_rules_insert ON coverage_rules;
CREATE POLICY coverage_rules_insert ON coverage_rules FOR INSERT
  WITH CHECK (can_write_clinical(clinic_id));

DROP POLICY IF EXISTS coverage_rules_update ON coverage_rules;
CREATE POLICY coverage_rules_update ON coverage_rules FOR UPDATE
  USING (can_write_clinical(clinic_id));

DROP POLICY IF EXISTS coverage_rules_delete ON coverage_rules;
CREATE POLICY coverage_rules_delete ON coverage_rules FOR DELETE
  USING (can_write_clinical(clinic_id));
