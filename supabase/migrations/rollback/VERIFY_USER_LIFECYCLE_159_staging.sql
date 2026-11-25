-- Read-only / smoke checks after 159_secure_user_lifecycle on staging.
-- Does not delete real clinic data.

SELECT
  to_regprocedure('public.admin_deactivate_clinic_member(uuid,uuid)') IS NOT NULL AS has_deactivate,
  to_regprocedure('public.admin_reactivate_clinic_member(uuid,uuid)') IS NOT NULL AS has_reactivate,
  to_regprocedure('public.admin_unlink_clinic_member(uuid,uuid)') IS NOT NULL AS has_unlink,
  to_regprocedure('public.admin_permanently_delete_clinic_user(uuid,uuid)') IS NOT NULL AS has_permanent_delete,
  to_regprocedure('public.assert_not_last_active_clinic_admin(uuid,uuid)') IS NOT NULL AS has_last_admin_guard,
  to_regprocedure('public._nullify_all_nullable_profile_refs(uuid)') IS NOT NULL AS has_nullify_all;

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'account_status'
  ) AS profiles_account_status,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinical_records'
      AND column_name = 'created_by' AND is_nullable = 'YES'
  ) AS clinical_records_created_by_nullable,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinical_record_audit'
      AND column_name = 'changed_by' AND is_nullable = 'YES'
  ) AS clinical_audit_changed_by_nullable;

-- Preservation smoke (counts should remain queryable; not a wipe).
SELECT
  (SELECT COUNT(*) FROM clinics) AS clinics_count,
  (SELECT COUNT(*) FROM patients) AS patients_count,
  (SELECT COUNT(*) FROM clinical_records) AS clinical_records_count,
  (SELECT COUNT(*) FROM professionals) AS professionals_count,
  (SELECT COUNT(*) FROM clinic_members) AS clinic_members_count;
