-- Medical orders v2 — LAST-RESORT destructive rollback of 20260929100000 + 20260929110000 + 20261014120000.
-- Replaces rollback/20260929100000_medical_orders_v2.down.sql for production use. That file is kept for
-- history, but it fails (can_view_medical_orders is dropped while medical_order_items policies still use it),
-- and it leaves the v2 columns in place, which makes the application keep writing v2 orders with no guard.
--
-- DATA LOSS — read before running:
--   * Structured data is removed from medical_orders (category, number, diagnosis, indication, priority,
--     validity, patient/issuer snapshots, document hash, void data). Rows survive as legacy orders
--     (order_text, status, patient, professional and dates are kept).
--   * medical_order_items, medical_order_catalog (incl. clinic custom entries) and numbering counters are dropped.
--   * Every QR / verification link on printed or shared orders stops verifying (verify_medical_order is dropped).
--   * Secretary grants for medical-order permissions are deleted.
--   A copy of the affected rows is kept in schema rollback_export (not exposed to the API); it does NOT replace
--   a verified backup / PITR point taken immediately before.
--
-- Preferred recovery is containment (recovery-medical-orders-v2-freeze.sql) plus a forward fix.
-- When issued or void v2 orders exist this script refuses to run unless, in the same session:
--   SET nexclinic.confirm_v2_data_loss = 'EXPORTED_AND_APPROVED';
-- Run as the table owner (postgres). The whole script is one transaction; any error rolls everything back.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  v_documents BIGINT;
BEGIN
  IF to_regclass('public.medical_order_items') IS NULL THEN
    RAISE EXCEPTION 'MEDICAL_ORDERS_V2_NOT_INSTALLED';
  END IF;
  SELECT count(*) INTO v_documents FROM public.medical_orders
  WHERE order_category IS NOT NULL AND status IN ('issued', 'void');
  IF v_documents > 0
     AND current_setting('nexclinic.confirm_v2_data_loss', true) IS DISTINCT FROM 'EXPORTED_AND_APPROVED' THEN
    RAISE EXCEPTION 'MEDICAL_ORDERS_V2_DOCUMENTS_EXIST: % issued/void v2 orders would lose structured data and verification. Use containment instead, or set nexclinic.confirm_v2_data_loss after export and approval.', v_documents;
  END IF;
END $$;

-- 1. Export (fails if a previous export exists; never overwrite one).
CREATE SCHEMA IF NOT EXISTS rollback_export;
REVOKE ALL ON SCHEMA rollback_export FROM PUBLIC, anon, authenticated;
CREATE TABLE rollback_export.medical_orders_v2 AS
  SELECT * FROM public.medical_orders WHERE order_category IS NOT NULL;
CREATE TABLE rollback_export.medical_order_items AS SELECT * FROM public.medical_order_items;
CREATE TABLE rollback_export.medical_order_catalog AS SELECT * FROM public.medical_order_catalog;
CREATE TABLE rollback_export.medical_order_counters AS SELECT * FROM public.medical_order_counters;
CREATE TABLE rollback_export.medical_order_role_permissions AS
  SELECT * FROM public.clinic_role_permissions
  WHERE permission_key IN ('viewMedicalOrders', 'issueMedicalOrders', 'cancelMedicalOrders', 'shareMedicalOrders');
CREATE TABLE rollback_export.medical_order_member_permissions AS
  SELECT * FROM public.clinic_member_permissions
  WHERE permission_key IN ('viewMedicalOrders', 'issueMedicalOrders', 'cancelMedicalOrders', 'shareMedicalOrders');
REVOKE ALL ON ALL TABLES IN SCHEMA rollback_export FROM PUBLIC, anon, authenticated;

-- 2. Triggers and document functions.
DROP TRIGGER IF EXISTS trg_medical_orders_00_v2_recovery_freeze ON public.medical_orders;
DROP FUNCTION IF EXISTS public.medical_orders_v2_recovery_freeze();
DROP TRIGGER IF EXISTS trg_medical_orders_v2_guard ON public.medical_orders;
DROP TRIGGER IF EXISTS trg_medical_orders_v2_prevent_delete ON public.medical_orders;
DROP FUNCTION IF EXISTS public.medical_orders_v2_guard();
DROP FUNCTION IF EXISTS public.medical_orders_v2_prevent_delete();
DROP FUNCTION IF EXISTS public.medical_orders_v2_issue(public.medical_orders);
DROP FUNCTION IF EXISTS public.medical_order_content_hash(public.medical_orders);
DROP FUNCTION IF EXISTS public.verify_medical_order(TEXT);

-- 3. Legacy select policy (as in 047), then the v2 tables, then the helper their policies used.
DROP POLICY IF EXISTS medical_orders_select ON public.medical_orders;
CREATE POLICY medical_orders_select ON public.medical_orders FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));

DROP TABLE IF EXISTS public.medical_order_items;
DROP FUNCTION IF EXISTS public.medical_order_items_guard();
DROP TABLE IF EXISTS public.medical_order_catalog;
DROP FUNCTION IF EXISTS public.next_medical_order_number(UUID);
DROP TABLE IF EXISTS public.medical_order_counters;
DROP FUNCTION IF EXISTS public.can_view_medical_orders(UUID);

-- 4. Indexes, constraints and columns on medical_orders.
DROP INDEX IF EXISTS public.idx_medical_orders_clinic_number;
DROP INDEX IF EXISTS public.idx_medical_orders_verification_token;
DROP INDEX IF EXISTS public.idx_medical_orders_clinic_issued;
DROP INDEX IF EXISTS public.idx_medical_orders_clinic_professional;
DROP INDEX IF EXISTS public.idx_medical_orders_clinic_status;
ALTER TABLE public.medical_orders
  DROP CONSTRAINT IF EXISTS medical_orders_order_category_check,
  DROP CONSTRAINT IF EXISTS medical_orders_priority_check,
  DROP CONSTRAINT IF EXISTS medical_orders_void_reason_len,
  DROP CONSTRAINT IF EXISTS medical_orders_token_format;
ALTER TABLE public.medical_orders
  DROP COLUMN IF EXISTS order_category,
  DROP COLUMN IF EXISTS order_number,
  DROP COLUMN IF EXISTS public_verification_token,
  DROP COLUMN IF EXISTS diagnosis_text,
  DROP COLUMN IF EXISTS diagnosis_code,
  DROP COLUMN IF EXISTS clinical_indication,
  DROP COLUMN IF EXISTS preparation_instructions,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS valid_until,
  DROP COLUMN IF EXISTS patient_snapshot,
  DROP COLUMN IF EXISTS issuer_snapshot,
  DROP COLUMN IF EXISTS document_hash,
  DROP COLUMN IF EXISTS voided_at,
  DROP COLUMN IF EXISTS voided_by,
  DROP COLUMN IF EXISTS void_reason,
  DROP COLUMN IF EXISTS external_provider,
  DROP COLUMN IF EXISTS external_reference,
  DROP COLUMN IF EXISTS external_status;

-- 5. Permission keys back to the 20260928220000 whitelist.
DELETE FROM public.clinic_role_permissions
WHERE permission_key IN ('viewMedicalOrders', 'issueMedicalOrders', 'cancelMedicalOrders', 'shareMedicalOrders');
DELETE FROM public.clinic_member_permissions
WHERE permission_key IN ('viewMedicalOrders', 'issueMedicalOrders', 'cancelMedicalOrders', 'shareMedicalOrders');
CREATE OR REPLACE FUNCTION public.clinic_manageable_permission_keys()
RETURNS TEXT[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY[
    'manageAppointments', 'managePatients', 'managePatientsAdmin', 'viewClinicalRecords',
    'viewPharmacology', 'editClinicalRecords', 'issuePrescriptions', 'viewReports',
    'managePayments', 'manageCashRegister', 'manageWaitingRoom', 'manageAdminDocuments',
    'importPatients', 'exportPatients', 'importClinicalRecords', 'exportClinicalRecords',
    'bulkExportData', 'viewGeriatrics', 'manageGeriatrics'
  ]::TEXT[];
$$;

-- 6. Verify the legacy schema is back; otherwise abort the whole transaction.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'medical_orders'
               AND column_name IN ('order_category', 'order_number', 'document_hash', 'public_verification_token'))
     OR to_regclass('public.medical_order_items') IS NOT NULL
     OR to_regclass('public.medical_order_catalog') IS NOT NULL
     OR to_regclass('public.medical_order_counters') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.medical_orders'::regclass AND tgname LIKE '%v2%')
     OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                AND proname IN ('can_view_medical_orders', 'medical_order_items_guard', 'verify_medical_order',
                                'medical_orders_v2_guard', 'next_medical_order_number')) THEN
    RAISE EXCEPTION 'MEDICAL_ORDERS_V2_ROLLBACK_INCOMPLETE';
  END IF;
END $$;

COMMIT;
