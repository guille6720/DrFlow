-- Medical orders v2: allow the service-role clinical purge (131) to delete clinical records that issued
-- orders point to. medical_orders.clinical_record_id is ON DELETE SET NULL, and the v2 guard rejected that
-- automatic UPDATE with MEDICAL_ORDER_IMMUTABLE, aborting purge_clinic_clinical_data_for_migration.
--
-- The exception is limited to: purge flag set (transaction-local, only set by service-role RPCs), the link
-- going from a record to NULL, the referenced record no longer existing, and no other column changing.
-- The document (number, hash, snapshots, items, status) is untouched; the hash never covered the link.
-- Each detach is written to audit_logs.
-- Requires 20260929100000_medical_orders_v2.sql. Rollback: rollback/20261014120000_*.down.sql

DO $$
BEGIN
  IF to_regprocedure('public.medical_orders_v2_issue(public.medical_orders)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_PREREQUISITE_MISSING: apply 20260929100000_medical_orders_v2.sql first';
  END IF;
END $$;

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

  -- Issued / void: the clinical purge deletes the linked record and the FK nulls the link.
  IF COALESCE(current_setting('app.allow_clinical_hard_delete', true), 'false') = 'true'
     AND OLD.clinical_record_id IS NOT NULL
     AND NEW.clinical_record_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.clinical_records cr WHERE cr.id = OLD.clinical_record_id)
     AND (to_jsonb(NEW) - (v_ignore || ARRAY['clinical_record_id']))
       = (to_jsonb(OLD) - (v_ignore || ARRAY['clinical_record_id'])) THEN
    NEW.issued_at := OLD.issued_at;
    NEW.created_at := OLD.created_at;
    INSERT INTO public.audit_logs (
      clinic_id, user_id, patient_id, entity_type, entity_id, action, module, what,
      old_values, new_values, metadata
    ) VALUES (
      OLD.clinic_id,
      auth.uid(),
      OLD.patient_id,
      'medical_order',
      OLD.id,
      'update'::audit_action,
      'orders',
      'MEDICAL_ORDER_CLINICAL_RECORD_DETACHED',
      jsonb_build_object('clinical_record_id', OLD.clinical_record_id),
      jsonb_build_object('clinical_record_id', NULL),
      jsonb_build_object(
        'order_number', OLD.order_number,
        'status', OLD.status,
        'document_hash', OLD.document_hash,
        'reason', 'clinical_record_hard_delete'
      )
    );
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
