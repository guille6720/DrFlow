-- Optimistic locking for medical_orders (integer version, no timestamp precision issues)

ALTER TABLE medical_orders
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN medical_orders.version IS 'Incremented on each update/void; used for optimistic concurrency control.';
