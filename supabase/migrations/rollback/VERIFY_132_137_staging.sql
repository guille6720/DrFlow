-- Post-apply verification for compliance migrations 132–137 (staging/local).
-- Single-row read-only check (supabase db query returns last statement).
-- DO NOT use as a production migration.

SELECT
  to_regprocedure('public.enforce_audit_insert_integrity()') IS NOT NULL
    AS has_audit_insert_fn,
  (
    SELECT COUNT(*) > 0
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN ('audit_logs_insert_integrity', 'clinical_record_audit_insert_integrity')
  ) AS has_audit_insert_triggers,
  to_regprocedure('public.assert_public_api_clinic_access(uuid)') IS NOT NULL
    AS has_public_api_gate,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consent_records'
      AND column_name = 'withdrawn_at'
  ) AS has_consent_withdrawn_at,
  to_regclass('public.privacy_rights_requests') IS NOT NULL
    AS has_privacy_rights_table,
  COALESCE(
    (
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'privacy_rights_requests'
    ),
    false
  ) AS privacy_rights_rls_enabled,
  COALESCE(
    (SELECT NOT public FROM storage.buckets WHERE id = 'clinical-files'),
    false
  ) AS clinical_files_private,
  (
    SELECT pg_get_functiondef('public.clinic_subscription_active(uuid)'::regprocedure)
      ILIKE '%canceled%'
  ) AS subscription_active_includes_canceled,
  (SELECT COUNT(*) FROM clinics) >= 0 AS clinics_readable,
  (SELECT COUNT(*) FROM profiles) >= 0 AS profiles_readable;
