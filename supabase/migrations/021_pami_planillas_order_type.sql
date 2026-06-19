/* Planillas PAMI: internación domiciliaria, geriátrico, insumos, etc. */

ALTER TABLE medical_orders DROP CONSTRAINT IF EXISTS medical_orders_order_type_check;

ALTER TABLE medical_orders
  ADD CONSTRAINT medical_orders_order_type_check
  CHECK (order_type IN ('study', 'referral', 'pami_form'));
