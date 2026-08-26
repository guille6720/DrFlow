-- Reconcile remote Staging migration 20260826114630_internal_helper_execute_hardening
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- Phase 4 pack 3: internal trigger/helper functions must not be direct API surfaces.

REVOKE EXECUTE ON FUNCTION public._maintain_audit_refs_for_user_deletion(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._nullify_profile_ref(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._reassign_profile_ref(text, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.onboard_clinic_entitlement_subscription()
  FROM PUBLIC, anon, authenticated;

-- Worker-only notification queue operations.
REVOKE EXECUTE ON FUNCTION public.claim_appointment_notifications(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_appointment_notifications(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_appointment_notification(uuid, public.reminder_status, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_appointment_notification(uuid, public.reminder_status, text) TO service_role;

-- Maintenance job.
REVOKE EXECUTE ON FUNCTION public.purge_old_observability_events(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_observability_events(integer) TO service_role;;
