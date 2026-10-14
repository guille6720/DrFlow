-- Medical orders v2 — lifts the containment applied by recovery-medical-orders-v2-freeze.sql.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TRIGGER IF EXISTS trg_medical_orders_00_v2_recovery_freeze ON public.medical_orders;
DROP FUNCTION IF EXISTS public.medical_orders_v2_recovery_freeze();
COMMIT;
