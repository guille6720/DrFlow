-- Reconcile remote Staging migration 20260826114420_security_definer_execute_hardening
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- Phase 4 security hardening: least-privilege EXECUTE for privileged functions.
-- Staging-only validation. This migration changes privileges/default privileges only.

-- Destructive/internal helpers: remove direct client access.
-- Keep service_role compatibility where it already existed; internal postgres-owned
-- function calls and trigger invocation continue to work independently of client grants.
REVOKE EXECUTE ON FUNCTION public.delete_auth_user_by_email(text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_user_profile_references(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_clinical_record_children(uuid, uuid, uuid, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_auth_user_before_delete()
  FROM PUBLIC, anon, authenticated;

-- Worker operations: service_role only.
REVOKE EXECUTE ON FUNCTION public.claim_clinic_jobs(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_clinic_jobs(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_clinic_job(uuid, text, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_clinic_job(uuid, text, jsonb, text) TO service_role;

-- Intentional signed-in RPCs: deny anonymous/public direct access, retain authenticated.
REVOKE EXECUTE ON FUNCTION public.delete_own_account(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_clinic_member_user(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_clinic_member_user(uuid, uuid) TO authenticated;

-- Future functions must opt in to browser/client access.
-- service_role remains available by default for server-side compatibility.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;;
