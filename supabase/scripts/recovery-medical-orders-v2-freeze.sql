-- Medical orders v2 — preferred recovery: CONTAINMENT (non-destructive, reversible).
-- Stops new v2 orders from being created or issued while keeping everything that already exists intact:
-- issued/void documents, numbering, hashes, snapshots, items, QR verification, immutability, delete
-- protection, annulment (void with reason) and all legacy medical-order workflows.
-- Use while a forward fix is prepared. Undo with recovery-medical-orders-v2-unfreeze.sql.
-- Run as the table owner (postgres) in one transaction. Never use a destructive rollback once real v2 orders exist.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public.medical_orders_v2_guard()') IS NULL THEN
    RAISE EXCEPTION 'MEDICAL_ORDERS_V2_NOT_INSTALLED: nothing to freeze';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.medical_orders_v2_recovery_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.order_category IS NOT NULL THEN
    RAISE EXCEPTION 'MEDICAL_ORDERS_V2_FROZEN: new structured medical orders are temporarily disabled'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.order_category IS NOT NULL
     AND OLD.status = 'draft' AND NEW.status = 'issued' THEN
    RAISE EXCEPTION 'MEDICAL_ORDERS_V2_FROZEN: issuing structured medical orders is temporarily disabled'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.medical_orders_v2_recovery_freeze() FROM PUBLIC, anon, authenticated;

-- Name sorts before trg_medical_orders_v2_guard so it fires first (no order number is consumed).
DROP TRIGGER IF EXISTS trg_medical_orders_00_v2_recovery_freeze ON public.medical_orders;
CREATE TRIGGER trg_medical_orders_00_v2_recovery_freeze
  BEFORE INSERT OR UPDATE ON public.medical_orders
  FOR EACH ROW EXECUTE FUNCTION public.medical_orders_v2_recovery_freeze();

COMMIT;
