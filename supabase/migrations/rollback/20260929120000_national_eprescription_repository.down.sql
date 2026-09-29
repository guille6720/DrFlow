-- Rollback for 20260929120000_national_eprescription_repository.sql (STAGING).
-- Drops only objects created by that migration. Legacy REFEPS/CUIR columns are not touched.

DROP TRIGGER IF EXISTS trg_guard_national_rx_columns ON public.prescription_drafts;
DROP FUNCTION IF EXISTS public.guard_national_rx_columns();
DROP FUNCTION IF EXISTS public.national_rx_transition_allowed(text, text);
DROP FUNCTION IF EXISTS public.national_rx_is_server_writer();

DROP INDEX IF EXISTS public.idx_prescription_drafts_national_idempotency;
DROP INDEX IF EXISTS public.idx_prescription_drafts_national_submission;
DROP INDEX IF EXISTS public.idx_prescription_drafts_cuir;
DROP INDEX IF EXISTS public.idx_prescription_drafts_national_state;

ALTER TABLE public.prescription_drafts
  DROP CONSTRAINT IF EXISTS prescription_drafts_national_rx_state_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_national_rx_not_draft_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_repository_mode_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_repository_status_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_refeps_professional_status_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_refeps_validation_mode_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_cuir_official_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_sandbox_reference_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_cuir_assigned_requires_cuir_check,
  DROP CONSTRAINT IF EXISTS prescription_drafts_national_attempts_check;

ALTER TABLE public.prescription_drafts
  DROP COLUMN IF EXISTS national_rx_state,
  DROP COLUMN IF EXISTS national_rx_updated_at,
  DROP COLUMN IF EXISTS national_submission_id,
  DROP COLUMN IF EXISTS national_idempotency_key,
  DROP COLUMN IF EXISTS national_correlation_id,
  DROP COLUMN IF EXISTS national_attempts,
  DROP COLUMN IF EXISTS repository_provider,
  DROP COLUMN IF EXISTS repository_mode,
  DROP COLUMN IF EXISTS repository_prescription_id,
  DROP COLUMN IF EXISTS provider_request_id,
  DROP COLUMN IF EXISTS repository_status,
  DROP COLUMN IF EXISTS repository_submitted_at,
  DROP COLUMN IF EXISTS repository_last_checked_at,
  DROP COLUMN IF EXISTS repository_error_code,
  DROP COLUMN IF EXISTS repository_error_message,
  DROP COLUMN IF EXISTS sandbox_reference,
  DROP COLUMN IF EXISTS cuir,
  DROP COLUMN IF EXISTS cuir_received_at,
  DROP COLUMN IF EXISTS cuir_verified_at,
  DROP COLUMN IF EXISTS refeps_professional_status,
  DROP COLUMN IF EXISTS refeps_validation_mode,
  DROP COLUMN IF EXISTS refeps_validated_at;

DELETE FROM public.feature_definitions WHERE feature_key = 'national_electronic_prescription';
