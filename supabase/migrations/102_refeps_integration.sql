-- Fase 2E: integración REFEPS / RENaPDiS (adapter + firma digital + trazabilidad)

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS refeps_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refeps_establishment_code TEXT,
  ADD COLUMN IF NOT EXISTS refeps_auto_submit BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN clinics.refeps_enabled IS
  'Habilita envío a REFEPS/RENaPDiS cuando la clínica tiene homologación y credenciales API.';
COMMENT ON COLUMN clinics.refeps_establishment_code IS
  'Código de establecimiento asignado en trámite REFEPS (MSN).';
COMMENT ON COLUMN clinics.refeps_auto_submit IS
  'Enviar automáticamente a REFEPS al emitir receta (si refeps_enabled).';

ALTER TABLE prescription_drafts
  ADD COLUMN IF NOT EXISTS refeps_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refeps_error TEXT,
  ADD COLUMN IF NOT EXISTS refeps_payload JSONB,
  ADD COLUMN IF NOT EXISTS digital_signature_hash TEXT;

COMMENT ON COLUMN prescription_drafts.digital_signature_hash IS
  'Hash SHA-256 del payload canónico firmado (preparación firma digital REFEPS).';
COMMENT ON COLUMN prescription_drafts.refeps_payload IS
  'Snapshot JSON enviado o generado para REFEPS/RENaPDiS.';

ALTER TABLE prescription_drafts
  DROP CONSTRAINT IF EXISTS prescription_drafts_refeps_status_check;

ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_refeps_status_check
  CHECK (refeps_status IN ('local', 'pending_refeps', 'submitted', 'failed'));

ALTER TABLE prescription_events
  DROP CONSTRAINT IF EXISTS prescription_events_event_type_check;

ALTER TABLE prescription_events
  ADD CONSTRAINT prescription_events_event_type_check
  CHECK (
    event_type IN (
      'created',
      'updated',
      'validated',
      'issued',
      'voided',
      'dispensed',
      'template_applied',
      'refeps_submitted',
      'refeps_failed'
    )
  );
