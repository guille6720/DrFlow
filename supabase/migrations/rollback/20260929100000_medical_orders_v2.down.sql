-- Reverts 20260929100000_medical_orders_v2.sql.
-- WARNING: drops v2 order items/catalog/counters. Legacy medical_orders rows are not affected.
-- v2 rows (order_category IS NOT NULL) stay in medical_orders; export them first if needed.

DROP TRIGGER IF EXISTS trg_medical_orders_v2_guard ON public.medical_orders;
DROP TRIGGER IF EXISTS trg_medical_orders_v2_prevent_delete ON public.medical_orders;
DROP FUNCTION IF EXISTS public.medical_orders_v2_guard();
DROP FUNCTION IF EXISTS public.medical_orders_v2_prevent_delete();
DROP FUNCTION IF EXISTS public.medical_orders_v2_issue(public.medical_orders);
DROP FUNCTION IF EXISTS public.medical_order_content_hash(public.medical_orders);
DROP FUNCTION IF EXISTS public.verify_medical_order(TEXT);

DROP POLICY IF EXISTS medical_orders_select ON public.medical_orders;
CREATE POLICY medical_orders_select ON public.medical_orders FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));
DROP FUNCTION IF EXISTS public.can_view_medical_orders(UUID);

DROP TABLE IF EXISTS public.medical_order_items;
DROP TABLE IF EXISTS public.medical_order_catalog;
DROP FUNCTION IF EXISTS public.next_medical_order_number(UUID);
DROP TABLE IF EXISTS public.medical_order_counters;

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

-- Columns are kept (nullable) to avoid data loss; drop manually after export if required:
-- ALTER TABLE public.medical_orders DROP COLUMN order_category, DROP COLUMN order_number, ...
