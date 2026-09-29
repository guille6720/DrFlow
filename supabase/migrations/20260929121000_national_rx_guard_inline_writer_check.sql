-- Fix for 20260929120000: the guard trigger runs as the invoking role (authenticated) and called
-- public.national_rx_is_server_writer(), whose EXECUTE is revoked from authenticated. That would make
-- every browser INSERT into prescription_drafts fail. The writer check is now evaluated inline, so the
-- helper functions stay non-executable for anon/authenticated. Behavior is otherwise identical.
-- Rollback: supabase/migrations/rollback/20260929121000_national_rx_guard_inline_writer_check.down.sql

CREATE OR REPLACE FUNCTION public.guard_national_rx_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_changed boolean;
  v_server boolean;
BEGIN
  v_server :=
       COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'service_role');

  IF TG_OP = 'INSERT' THEN
    IF NOT v_server AND (
      NEW.national_rx_state IS NOT NULL OR NEW.national_submission_id IS NOT NULL
      OR NEW.national_idempotency_key IS NOT NULL OR NEW.repository_provider IS NOT NULL
      OR NEW.repository_mode IS NOT NULL OR NEW.repository_prescription_id IS NOT NULL
      OR NEW.sandbox_reference IS NOT NULL OR NEW.cuir IS NOT NULL
      OR NEW.refeps_professional_status IS NOT NULL OR NEW.national_attempts <> 0
    ) THEN
      RAISE EXCEPTION 'NATIONAL_RX_SERVER_ONLY' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  v_changed :=
       NEW.national_rx_state IS DISTINCT FROM OLD.national_rx_state
    OR NEW.national_rx_updated_at IS DISTINCT FROM OLD.national_rx_updated_at
    OR NEW.national_submission_id IS DISTINCT FROM OLD.national_submission_id
    OR NEW.national_idempotency_key IS DISTINCT FROM OLD.national_idempotency_key
    OR NEW.national_correlation_id IS DISTINCT FROM OLD.national_correlation_id
    OR NEW.national_attempts IS DISTINCT FROM OLD.national_attempts
    OR NEW.repository_provider IS DISTINCT FROM OLD.repository_provider
    OR NEW.repository_mode IS DISTINCT FROM OLD.repository_mode
    OR NEW.repository_prescription_id IS DISTINCT FROM OLD.repository_prescription_id
    OR NEW.provider_request_id IS DISTINCT FROM OLD.provider_request_id
    OR NEW.repository_status IS DISTINCT FROM OLD.repository_status
    OR NEW.repository_submitted_at IS DISTINCT FROM OLD.repository_submitted_at
    OR NEW.repository_last_checked_at IS DISTINCT FROM OLD.repository_last_checked_at
    OR NEW.repository_error_code IS DISTINCT FROM OLD.repository_error_code
    OR NEW.repository_error_message IS DISTINCT FROM OLD.repository_error_message
    OR NEW.sandbox_reference IS DISTINCT FROM OLD.sandbox_reference
    OR NEW.cuir IS DISTINCT FROM OLD.cuir
    OR NEW.cuir_received_at IS DISTINCT FROM OLD.cuir_received_at
    OR NEW.cuir_verified_at IS DISTINCT FROM OLD.cuir_verified_at
    OR NEW.refeps_professional_status IS DISTINCT FROM OLD.refeps_professional_status
    OR NEW.refeps_validation_mode IS DISTINCT FROM OLD.refeps_validation_mode
    OR NEW.refeps_validated_at IS DISTINCT FROM OLD.refeps_validated_at;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  IF NOT v_server THEN
    RAISE EXCEPTION 'NATIONAL_RX_SERVER_ONLY' USING ERRCODE = '42501';
  END IF;

  IF OLD.cuir IS NOT NULL AND NEW.cuir IS DISTINCT FROM OLD.cuir THEN
    RAISE EXCEPTION 'NATIONAL_RX_CUIR_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  IF OLD.sandbox_reference IS NOT NULL AND NEW.sandbox_reference IS DISTINCT FROM OLD.sandbox_reference THEN
    RAISE EXCEPTION 'NATIONAL_RX_SANDBOX_REFERENCE_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  IF OLD.national_idempotency_key IS NOT NULL AND NEW.national_idempotency_key IS DISTINCT FROM OLD.national_idempotency_key THEN
    RAISE EXCEPTION 'NATIONAL_RX_IDEMPOTENCY_KEY_IMMUTABLE' USING ERRCODE = '42501';
  END IF;

  IF NEW.national_rx_state IS DISTINCT FROM OLD.national_rx_state THEN
    IF NEW.national_rx_state IS NULL
       OR NOT public.national_rx_transition_allowed(OLD.national_rx_state, NEW.national_rx_state) THEN
      RAISE EXCEPTION 'NATIONAL_RX_INVALID_TRANSITION' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_national_rx_columns() FROM PUBLIC, anon, authenticated;
