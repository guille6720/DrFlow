-- Reverts 20260928220000: removes Geriatrics rows and restores the original 17-key list.
DELETE FROM public.clinic_role_permissions
WHERE permission_key IN ('viewGeriatrics', 'manageGeriatrics');

ALTER TABLE public.clinic_role_permissions
  DROP CONSTRAINT IF EXISTS clinic_role_permissions_permission_key_check;
ALTER TABLE public.clinic_role_permissions
  ADD CONSTRAINT clinic_role_permissions_permission_key_check
  CHECK (permission_key IN (
    'manageAppointments', 'managePatients', 'managePatientsAdmin', 'viewClinicalRecords',
    'viewPharmacology', 'editClinicalRecords', 'issuePrescriptions', 'viewReports',
    'managePayments', 'manageCashRegister', 'manageWaitingRoom', 'manageAdminDocuments',
    'importPatients', 'exportPatients', 'importClinicalRecords', 'exportClinicalRecords',
    'bulkExportData'
  ));

-- Re-apply 20260928203000_clinic_role_permissions.sql (function section) to restore the inline key list,
-- then drop the helper:
-- DROP FUNCTION IF EXISTS public.clinic_manageable_permission_keys();
