-- Idempotency keys for medical order creation (prevents duplicate PAMI / double-submit).

ALTER TABLE medical_orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

COMMENT ON COLUMN medical_orders.idempotency_key IS
  'Optional client UUID; unique per clinic prevents duplicate inserts on double-submit.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_orders_clinic_idempotency
  ON medical_orders (clinic_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
