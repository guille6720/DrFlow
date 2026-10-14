-- Reverts 20261014120000_medical_orders_v2_guard_clinical_purge_detach.sql: restores the guard exactly as
-- defined in 20260929100000_medical_orders_v2.sql. The clinical purge then fails again with
-- MEDICAL_ORDER_IMMUTABLE when an issued/void v2 order is linked to a record being deleted (defect D4).
-- Audit rows already written by the fix are kept (audit_logs is append-only).

CREATE OR REPLACE FUNCTION public.medical_orders_v2_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Non-document bookkeeping that existing helpers may touch (date re-sync, user-deletion reassignment).
  v_ignore TEXT[] := ARRAY['updated_at', 'version', 'created_at', 'issued_at', 'created_by', 'voided_by'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Server-assigned fields can never come from the client.
    NEW.order_number := NULL;
    NEW.public_verification_token := NULL;
    NEW.issuer_snapshot := NULL;
    NEW.document_hash := NULL;
    NEW.voided_at := NULL;
    NEW.voided_by := NULL;
    IF NEW.order_category IS NULL THEN
      RETURN NEW; -- legacy order: unchanged behavior
    END IF;
    IF NEW.status NOT IN ('draft', 'issued') THEN
      RAISE EXCEPTION 'MEDICAL_ORDER_INVALID_STATUS';
    END IF;
    IF NEW.status = 'issued' THEN
      NEW := public.medical_orders_v2_issue(NEW);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.order_category IS NULL THEN
    IF NEW.order_category IS NOT NULL THEN
      RAISE EXCEPTION 'MEDICAL_ORDER_CATEGORY_IMMUTABLE';
    END IF;
    RETURN NEW; -- legacy order: unchanged behavior
  END IF;

  IF NEW.order_category IS DISTINCT FROM OLD.order_category THEN
    RAISE EXCEPTION 'MEDICAL_ORDER_CATEGORY_IMMUTABLE';
  END IF;

  IF OLD.status = 'draft' THEN
    NEW.order_number := NULL;
    NEW.public_verification_token := NULL;
    NEW.issuer_snapshot := NULL;
    NEW.document_hash := NULL;
    IF NEW.status = 'issued' THEN
      NEW := public.medical_orders_v2_issue(NEW);
    ELSIF NEW.status = 'void' THEN
      NEW.voided_at := now();
      NEW.voided_by := auth.uid();
    END IF;
    RETURN NEW;
  END IF;

  -- Issued / void: dates may be re-synced by legacy helpers, but the document keeps its original values.
  IF (to_jsonb(NEW) - v_ignore) = (to_jsonb(OLD) - v_ignore) THEN
    NEW.issued_at := OLD.issued_at;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  IF OLD.status = 'issued' AND NEW.status = 'void'
     AND (to_jsonb(NEW) - (v_ignore || ARRAY['status', 'voided_at', 'void_reason']))
       = (to_jsonb(OLD) - (v_ignore || ARRAY['status', 'voided_at', 'void_reason'])) THEN
    IF NEW.void_reason IS NULL OR btrim(NEW.void_reason) = '' THEN
      RAISE EXCEPTION 'MEDICAL_ORDER_VOID_REASON_REQUIRED';
    END IF;
    NEW.void_reason := btrim(NEW.void_reason);
    NEW.voided_at := now();
    NEW.voided_by := auth.uid();
    NEW.issued_at := OLD.issued_at;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'MEDICAL_ORDER_IMMUTABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.medical_orders_v2_guard() FROM PUBLIC, anon, authenticated;
