-- Production fix: Fase 2E REFEPS (migration 102). Safe to re-run.

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS refeps_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refeps_establishment_code TEXT,
  ADD COLUMN IF NOT EXISTS refeps_auto_submit BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE prescription_drafts
  ADD COLUMN IF NOT EXISTS refeps_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refeps_error TEXT,
  ADD COLUMN IF NOT EXISTS refeps_payload JSONB,
  ADD COLUMN IF NOT EXISTS digital_signature_hash TEXT;

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
